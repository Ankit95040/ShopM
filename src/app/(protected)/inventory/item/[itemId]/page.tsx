import { db } from "@/server/db";
import { requireAuth } from "@/server/auth";
import { ItemDetailView } from "@/components/inventory/ItemDetailView";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const session = await requireAuth();

  const item = await db.inventoryItem.findFirst({
    where: { id: itemId, shopId: session.shopId, isDeleted: false },
    include: { category: { select: { name: true } } },
  });

  if (!item) {
    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto text-center space-y-4">
        <h2 className="text-lg font-black text-slate-900">Item not found</h2>
        <p className="text-xs text-slate-500">This item does not exist or belongs to another shop.</p>
        <Link href="/inventory" className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">
          Back to Inventory
        </Link>
      </div>
    );
  }

  const movementsRaw = await db.stockMovement.findMany({
    where: { itemId: item.id, shopId: session.shopId },
    include: { createdBy: { select: { name: true } } },
    orderBy: { movementDate: "desc" },
    take: 100,
  });

  const movements = movementsRaw.map((m) => ({
    id: m.id,
    type: m.type,
    quantity: Number(m.quantity),
    previousStock: Number(m.previousStock),
    newStock: Number(m.newStock),
    supplier: m.supplier,
    purchasePrice: m.purchasePrice ? Number(m.purchasePrice) : null,
    notes: m.notes,
    movementDate: m.movementDate,
    createdByName: m.createdBy.name,
    removalReason: m.removalReason,
  }));

  const itemData = {
    id: item.id,
    name: item.name,
    sku: item.sku,
    unit: item.unit,
    currentStock: Number(item.currentStock),
    minStockThreshold: Number(item.minStockThreshold),
    purchasePrice: item.purchasePrice ? Number(item.purchasePrice) : null,
    sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : null,
    categoryName: item.category.name,
    categoryId: item.categoryId,
    isLowStock: Number(item.currentStock) <= Number(item.minStockThreshold),
    isOutOfStock: Number(item.currentStock) <= 0,
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <ItemDetailView item={itemData} movements={movements} categoryName={item.category.name} />
    </div>
  );
}
