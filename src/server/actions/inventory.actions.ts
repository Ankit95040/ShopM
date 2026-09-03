"use server";

import { withPerformance } from "@/lib/performance";
import { db } from "@/server/db";
import { requireAuth } from "@/server/auth";
import { StockMovementType, StockRemovalReason, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

async function createCategoryActionImpl(name: string, description?: string) {
  try {
    const session = await requireAuth();
    if (!name.trim()) return { success: false, error: "Category name is required" };

    const category = await db.inventoryCategory.create({
      data: {
        shopId: session.shopId,
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    revalidatePath("/inventory");
    revalidatePath("/");
    return { success: true, category };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create category" };
  }
}
export const createCategoryAction = withPerformance("createCategoryAction", "action", createCategoryActionImpl);

async function createInventoryItemActionImpl({
  categoryId,
  locationId,
  name,
  sku,
  unit,
  minStockThreshold,
  purchasePrice,
  sellingPrice,
  initialStock = 0,
}: {
  categoryId: string;
  locationId?: string;
  name: string;
  sku?: string;
  unit: string;
  minStockThreshold?: number;
  purchasePrice?: number;
  sellingPrice?: number;
  initialStock?: number;
}) {
  try {
    const session = await requireAuth();
    if (!name.trim()) return { success: false, error: "Item name is required" };

    const category = await db.inventoryCategory.findFirst({
      where: { id: categoryId, shopId: session.shopId },
      select: { id: true },
    });
    if (!category) return { success: false, error: "Category not found" };

    if (locationId) {
      const location = await db.location.findFirst({
        where: { id: locationId, shopId: session.shopId, isDeleted: false },
        select: { id: true },
      });
      if (!location) return { success: false, error: "Location not found" };
    }

    const item = await db.$transaction(async (prisma) => {
      const newItem = await prisma.inventoryItem.create({
        data: {
          shopId: session.shopId,
          categoryId,
          locationId: locationId || null,
          name: name.trim(),
          sku: sku?.trim().toUpperCase() || null,
          unit: unit || "Pieces",
          currentStock: initialStock,
          minStockThreshold: minStockThreshold !== undefined ? minStockThreshold : 5,
          purchasePrice: purchasePrice || null,
          sellingPrice: sellingPrice || null,
          createdById: session.userId,
        },
      });

      if (initialStock > 0) {
        await prisma.stockMovement.create({
          data: {
            itemId: newItem.id,
            type: StockMovementType.ADD_STOCK,
            quantity: initialStock,
            previousStock: 0,
            newStock: initialStock,
            purchasePrice: purchasePrice || null,
            notes: "Initial Opening Stock",
            shopId: session.shopId,
            createdById: session.userId,
          },
        });
      }

      return newItem;
    });

    revalidatePath("/inventory");
    revalidatePath("/");

    // Return plain serialized object without Decimal
    return {
      success: true,
      item: {
        id: item.id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        currentStock: Number(item.currentStock),
        minStockThreshold: Number(item.minStockThreshold),
        purchasePrice: item.purchasePrice ? Number(item.purchasePrice) : null,
        sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : null,
        categoryId: item.categoryId,
        locationId: item.locationId,
        createdAt: item.createdAt,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create inventory item" };
  }
}
export const createInventoryItemAction = withPerformance("createInventoryItemAction", "action", createInventoryItemActionImpl);

async function addStockActionImpl({
  itemId,
  quantity,
  supplier,
  purchasePrice,
  notes,
  movementDate,
}: {
  itemId: string;
  quantity: number;
  supplier?: string;
  purchasePrice?: number;
  notes?: string;
  movementDate?: Date | string;
}) {
  try {
    const session = await requireAuth();
    if (!quantity || quantity <= 0) {
      return { success: false, error: "Quantity must be positive" };
    }

    const result = await db.$transaction(async (prisma) => {
      const item = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: itemId, shopId: session.shopId },
      });

      const prevStock = Number(item.currentStock);
      const newStock = prevStock + quantity;

      const updatedItem = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: {
          currentStock: newStock,
          purchasePrice: purchasePrice !== undefined ? purchasePrice : item.purchasePrice,
          updatedById: session.userId,
        },
      });

      const movement = await prisma.stockMovement.create({
        data: {
          shopId: session.shopId,
          itemId,
          type: StockMovementType.ADD_STOCK,
          quantity,
          previousStock: prevStock,
          newStock,
          supplier: supplier?.trim() || null,
          purchasePrice: purchasePrice || null,
          notes: notes?.trim() || null,
          movementDate: movementDate ? new Date(movementDate) : new Date(),
          createdById: session.userId,
        },
      });

      return {
        item: {
          id: updatedItem.id,
          name: updatedItem.name,
          currentStock: Number(updatedItem.currentStock),
          purchasePrice: updatedItem.purchasePrice ? Number(updatedItem.purchasePrice) : null,
        },
        movement: {
          id: movement.id,
          quantity: Number(movement.quantity),
          previousStock: Number(movement.previousStock),
          newStock: Number(movement.newStock),
        },
      };
    });

    revalidatePath("/inventory");
    revalidatePath("/inventory/history");
    revalidatePath("/");

    return { success: true, result };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to add stock" };
  }
}
export const addStockAction = withPerformance("addStockAction", "action", addStockActionImpl);

async function removeStockActionImpl({
  itemId,
  quantity,
  removalReason,
  notes,
  movementDate,
}: {
  itemId: string;
  quantity: number;
  removalReason: StockRemovalReason;
  notes?: string;
  movementDate?: Date | string;
}) {
  try {
    const session = await requireAuth();
    if (!quantity || quantity <= 0) {
      return { success: false, error: "Quantity must be positive" };
    }

    const result = await db.$transaction(async (prisma) => {
      const item = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: itemId, shopId: session.shopId },
      });

      const prevStock = Number(item.currentStock);
      const newStock = Math.max(0, prevStock - quantity);

      const updatedItem = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: {
          currentStock: newStock,
          updatedById: session.userId,
        },
      });

      const movement = await prisma.stockMovement.create({
        data: {
          shopId: session.shopId,
          itemId,
          type: StockMovementType.REMOVE_STOCK,
          removalReason,
          quantity,
          previousStock: prevStock,
          newStock,
          notes: notes?.trim() || null,
          movementDate: movementDate ? new Date(movementDate) : new Date(),
          createdById: session.userId,
        },
      });

      return {
        item: {
          id: updatedItem.id,
          name: updatedItem.name,
          currentStock: Number(updatedItem.currentStock),
        },
        movement: {
          id: movement.id,
          quantity: Number(movement.quantity),
          previousStock: Number(movement.previousStock),
          newStock: Number(movement.newStock),
        },
      };
    });

    revalidatePath("/inventory");
    revalidatePath("/inventory/history");
    revalidatePath("/");

    return { success: true, result };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to remove stock" };
  }
}
export const removeStockAction = withPerformance("removeStockAction", "action", removeStockActionImpl);

async function getInventoryActionImpl({
  categoryId,
  search,
  lowStockOnly = false,
}: {
  categoryId?: string;
  search?: string;
  lowStockOnly?: boolean;
} = {}) {
  try {
    const session = await requireAuth();
    const whereClause: Prisma.InventoryItemWhereInput = {
      shopId: session.shopId,
      isDeleted: false,
    };

    if (categoryId && categoryId !== "ALL") {
      whereClause.categoryId = categoryId;
    }

    if (search?.trim()) {
      whereClause.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { sku: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const [items, categories] = await Promise.all([
      db.inventoryItem.findMany({
        where: whereClause,
        include: {
          category: true,
          createdBy: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      }),
      db.inventoryCategory.findMany({
        where: { shopId: session.shopId },
        orderBy: { name: "asc" },
      }),
    ]);

    const formatted = items
      .map((item) => {
        const stock = Number(item.currentStock);
        const threshold = Number(item.minStockThreshold);
        const isLow = stock <= threshold;

        return {
          id: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          currentStock: stock,
          minStockThreshold: threshold,
          purchasePrice: item.purchasePrice ? Number(item.purchasePrice) : null,
          sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : null,
          categoryName: item.category.name,
          categoryId: item.categoryId,
          isLowStock: isLow,
          isOutOfStock: stock <= 0,
        };
      })
      .filter((item) => (!lowStockOnly ? true : item.isLowStock));

    return {
      success: true,
      items: formatted,
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch inventory" };
  }
}
export const getInventoryAction = withPerformance("getInventoryAction", "action", getInventoryActionImpl);

async function getStockMovementsActionImpl(itemId?: string) {
  try {
    const session = await requireAuth();
    const movements = await db.stockMovement.findMany({
      where: itemId
        ? { itemId, shopId: session.shopId }
        : { shopId: session.shopId },
      include: {
        item: { select: { name: true, sku: true, unit: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { movementDate: "desc" },
      take: 100,
    });

    const formatted = movements.map((m) => ({
      id: m.id,
      itemName: m.item.name,
      itemSku: m.item.sku,
      unit: m.item.unit,
      type: m.type,
      removalReason: m.removalReason,
      quantity: Number(m.quantity),
      previousStock: Number(m.previousStock),
      newStock: Number(m.newStock),
      supplier: m.supplier,
      purchasePrice: m.purchasePrice ? Number(m.purchasePrice) : null,
      notes: m.notes,
      movementDate: m.movementDate,
      createdByName: m.createdBy.name,
    }));

    return { success: true, movements: formatted };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch stock movements" };
  }
}
export const getStockMovementsAction = withPerformance("getStockMovementsAction", "action", getStockMovementsActionImpl);

async function getAllMovementsActionImpl() {
  try {
    const session = await requireAuth();

    const movements = await db.stockMovement.findMany({
      where: { shopId: session.shopId },
      include: {
        item: { select: { name: true, unit: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { movementDate: "desc" },
    });

    return {
      success: true,
      movements: movements.map((m) => ({
        id: m.id,
        type: m.type,
        quantity: Number(m.quantity),
        removalReason: m.removalReason,
        movementDate: m.movementDate,
        itemName: m.item?.name || "Item",
        itemUnit: m.item?.unit || "Unit",
        createdByName: m.createdBy?.name || "User",
      })),
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch movements" };
  }
}
export const getAllMovementsAction = withPerformance("getAllMovementsAction", "action", getAllMovementsActionImpl);
