"use server";

import { db } from "@/server/db";
import { getCurrentSession, getGuestSession } from "@/server/auth";
import { withPerformance } from "@/lib/performance";

async function copyDemoDataToShopActionImpl() {
  const authSession = await getCurrentSession();
  if (!authSession) {
    return { success: false, error: "You must be logged in to keep demo data." };
  }
  const guestSession = await getGuestSession();
  if (!guestSession || !guestSession.isGuest) {
    return { success: false, error: "No demo data found to keep." };
  }
  const demoShopId = guestSession.shopId;
  const targetShopId = authSession.shopId;

  if (demoShopId === targetShopId) {
    return { success: false, error: "Demo shop is the same as your current shop." };
  }

  // Verify demo shop is actually a demo shop and belongs to guest
  const demoShop = await db.shop.findFirst({
    where: { id: demoShopId, isDemo: true },
    select: { id: true },
  });
  if (!demoShop) {
    return { success: false, error: "Demo shop not found or not a demo." };
  }

  // Verify target shop belongs to authenticated user and is not demo
  const targetShop = await db.shop.findFirst({
    where: { id: targetShopId, isDemo: false },
    select: { id: true },
  });
  if (!targetShop) {
    return { success: false, error: "Target shop not found." };
  }

  // Prevent duplicate copy if target already has data? Allow but warn
  // Copy locations
  const demoLocations = await db.location.findMany({
    where: { shopId: demoShopId, isDeleted: false },
  });

  const locationIdMap = new Map<string, string>();
  for (const loc of demoLocations) {
    const newLoc = await db.location.create({
      data: {
        shopId: targetShopId,
        name: loc.name,
        description: loc.description,
        createdById: authSession.userId,
      },
    });
    locationIdMap.set(loc.id, newLoc.id);
  }

  // Copy customers
  const demoCustomers = await db.customer.findMany({
    where: { shopId: demoShopId, isDeleted: false },
  });
  const customerIdMap = new Map<string, string>();
  for (const cust of demoCustomers) {
    const newLocationId = locationIdMap.get(cust.locationId);
    if (!newLocationId) continue;
    const newCust = await db.customer.create({
      data: {
        shopId: targetShopId,
        locationId: newLocationId,
        name: cust.name,
        phone: cust.phone,
        address: cust.address,
        createdById: authSession.userId,
      },
    });
    customerIdMap.set(cust.id, newCust.id);
  }

  // Copy transactions
  const demoTransactions = await db.transaction.findMany({
    where: { shopId: demoShopId, isDeleted: false },
  });
  for (const tx of demoTransactions) {
    const newCustomerId = customerIdMap.get(tx.customerId);
    if (!newCustomerId) continue;
    await db.transaction.create({
      data: {
        shopId: targetShopId,
        customerId: newCustomerId,
        type: tx.type,
        amount: tx.amount,
        billNumber: tx.billNumber,
        paymentMethod: tx.paymentMethod,
        description: tx.description,
        billImageKey: null, // Do not copy R2 keys (tenant-scoped)
        transactionDate: tx.transactionDate,
        createdById: authSession.userId,
      },
    });
  }

  // Copy inventory categories
  const demoCategories = await db.inventoryCategory.findMany({
    where: { shopId: demoShopId },
  });
  const categoryIdMap = new Map<string, string>();
  for (const cat of demoCategories) {
    const newCat = await db.inventoryCategory.create({
      data: {
        shopId: targetShopId,
        name: cat.name,
        description: cat.description,
      },
    });
    categoryIdMap.set(cat.id, newCat.id);
  }

  // Copy inventory items
  const demoItems = await db.inventoryItem.findMany({
    where: { shopId: demoShopId, isDeleted: false },
  });
  const itemIdMap = new Map<string, string>();
  for (const item of demoItems) {
    const newCategoryId = categoryIdMap.get(item.categoryId);
    if (!newCategoryId) continue;
    const newLocationId = item.locationId ? locationIdMap.get(item.locationId) : null;
    const newItem = await db.inventoryItem.create({
      data: {
        shopId: targetShopId,
        categoryId: newCategoryId,
        locationId: newLocationId || undefined,
        name: item.name,
        unit: item.unit,
        currentStock: item.currentStock,
        minStockThreshold: item.minStockThreshold,
        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice,
        createdById: authSession.userId,
      },
    });
    itemIdMap.set(item.id, newItem.id);
  }

  // Copy stock movements (optional, for history)
  const demoMovements = await db.stockMovement.findMany({
    where: { shopId: demoShopId },
  });
  for (const mv of demoMovements) {
    const newItemId = itemIdMap.get(mv.itemId);
    if (!newItemId) continue;
    await db.stockMovement.create({
      data: {
        shopId: targetShopId,
        itemId: newItemId,
        type: mv.type,
        removalReason: mv.removalReason,
        quantity: mv.quantity,
        previousStock: mv.previousStock,
        newStock: mv.newStock,
        supplier: mv.supplier,
        purchasePrice: mv.purchasePrice,
        notes: mv.notes,
        createdById: authSession.userId,
        movementDate: mv.movementDate,
      },
    });
  }

  return { success: true, copied: { locations: demoLocations.length, customers: demoCustomers.length, transactions: demoTransactions.length } };
}
export const copyDemoDataToShopAction = withPerformance("copyDemoDataToShopAction", "action", copyDemoDataToShopActionImpl);

async function getDemoDataSummaryActionImpl() {
  const { getCurrentSession } = await import("@/server/auth");
  const authSession = await getCurrentSession();
  if (!authSession) {
    return { success: false, hasDemoData: false };
  }
  const guestSession = await getGuestSession();
  if (!guestSession || !guestSession.isGuest) {
    return { success: false, hasDemoData: false };
  }
  const counts = await Promise.all([
    db.location.count({ where: { shopId: guestSession.shopId, isDeleted: false } }),
    db.customer.count({ where: { shopId: guestSession.shopId, isDeleted: false } }),
    db.transaction.count({ where: { shopId: guestSession.shopId, isDeleted: false } }),
  ]);
  const hasData = counts.some((c) => c > 0);
  return { success: true, hasDemoData: hasData, counts: { locations: counts[0], customers: counts[1], transactions: counts[2] } };
}
export const getDemoDataSummaryAction = withPerformance("getDemoDataSummaryAction", "action", getDemoDataSummaryActionImpl);
