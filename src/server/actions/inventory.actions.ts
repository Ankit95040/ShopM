"use server";

import { db } from "@/server/db";
import { StockMovementType, StockRemovalReason } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function createCategoryAction(name: string, description?: string) {
  try {
    if (!name.trim()) return { success: false, error: "Category name is required" };

    const category = await db.inventoryCategory.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    revalidatePath("/inventory");
    return { success: true, category };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create category" };
  }
}

export async function createInventoryItemAction({
  categoryId,
  locationId,
  name,
  sku,
  unit,
  minStockThreshold,
  purchasePrice,
  sellingPrice,
  initialStock = 0,
  createdById,
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
  createdById: string;
}) {
  try {
    if (!name.trim()) return { success: false, error: "Item name is required" };

    const item = await db.$transaction(async (prisma) => {
      const newItem = await prisma.inventoryItem.create({
        data: {
          categoryId,
          locationId: locationId || null,
          name: name.trim(),
          sku: sku?.trim().toUpperCase() || null,
          unit: unit || "Pieces",
          currentStock: initialStock,
          minStockThreshold: minStockThreshold !== undefined ? minStockThreshold : 5,
          purchasePrice: purchasePrice || null,
          sellingPrice: sellingPrice || null,
          createdById,
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
            createdById,
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
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create inventory item" };
  }
}

export async function addStockAction({
  itemId,
  quantity,
  supplier,
  purchasePrice,
  notes,
  movementDate,
  createdById,
}: {
  itemId: string;
  quantity: number;
  supplier?: string;
  purchasePrice?: number;
  notes?: string;
  movementDate?: Date | string;
  createdById: string;
}) {
  try {
    if (!quantity || quantity <= 0) {
      return { success: false, error: "Quantity must be positive" };
    }

    const result = await db.$transaction(async (prisma) => {
      const item = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: itemId },
      });

      const prevStock = Number(item.currentStock);
      const newStock = prevStock + quantity;

      const updatedItem = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: {
          currentStock: newStock,
          purchasePrice: purchasePrice !== undefined ? purchasePrice : item.purchasePrice,
          updatedById: createdById,
        },
      });

      const movement = await prisma.stockMovement.create({
        data: {
          itemId,
          type: StockMovementType.ADD_STOCK,
          quantity,
          previousStock: prevStock,
          newStock,
          supplier: supplier?.trim() || null,
          purchasePrice: purchasePrice || null,
          notes: notes?.trim() || null,
          movementDate: movementDate ? new Date(movementDate) : new Date(),
          createdById,
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
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to add stock" };
  }
}

export async function removeStockAction({
  itemId,
  quantity,
  removalReason,
  notes,
  movementDate,
  createdById,
}: {
  itemId: string;
  quantity: number;
  removalReason: StockRemovalReason;
  notes?: string;
  movementDate?: Date | string;
  createdById: string;
}) {
  try {
    if (!quantity || quantity <= 0) {
      return { success: false, error: "Quantity must be positive" };
    }

    const result = await db.$transaction(async (prisma) => {
      const item = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: itemId },
      });

      const prevStock = Number(item.currentStock);
      const newStock = Math.max(0, prevStock - quantity);

      const updatedItem = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: {
          currentStock: newStock,
          updatedById: createdById,
        },
      });

      const movement = await prisma.stockMovement.create({
        data: {
          itemId,
          type: StockMovementType.REMOVE_STOCK,
          removalReason,
          quantity,
          previousStock: prevStock,
          newStock,
          notes: notes?.trim() || null,
          movementDate: movementDate ? new Date(movementDate) : new Date(),
          createdById,
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
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to remove stock" };
  }
}

export async function getInventoryAction({
  categoryId,
  search,
  lowStockOnly = false,
}: {
  categoryId?: string;
  search?: string;
  lowStockOnly?: boolean;
} = {}) {
  try {
    const whereClause: any = {
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

    const items = await db.inventoryItem.findMany({
      where: whereClause,
      include: {
        category: true,
        createdBy: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    const categories = await db.inventoryCategory.findMany({
      orderBy: { name: "asc" },
    });

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
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch inventory" };
  }
}

export async function getStockMovementsAction(itemId?: string) {
  try {
    const movements = await db.stockMovement.findMany({
      where: itemId ? { itemId } : undefined,
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
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch stock movements" };
  }
}
