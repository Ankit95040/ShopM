import { Suspense } from "react";
import { db } from "@/server/db";
import { requireAuth } from "@/server/auth";
import { CategoryDetailView } from "@/components/inventory/CategoryDetailView";
import Link from "next/link";

export const dynamic = "force-dynamic";

function CategorySkeleton() {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-4">
      <div className="h-10 w-32 bg-slate-200 rounded-xl animate-pulse" />
      <div className="h-6 w-48 bg-slate-200 rounded-lg animate-pulse" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

async function CategoryContent({ categoryId }: { categoryId: string }) {
  const session = await requireAuth();

  const category = await db.inventoryCategory.findFirst({
    where: { id: categoryId, shopId: session.shopId },
    select: { id: true, name: true },
  });

  if (!category) {
    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto text-center space-y-4">
        <h2 className="text-lg font-black text-slate-900">Category not found</h2>
        <p className="text-xs text-slate-500">This category does not exist or belongs to another shop.</p>
        <Link href="/inventory" className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">
          Back to Inventory
        </Link>
      </div>
    );
  }

  const itemsRaw = await db.inventoryItem.findMany({
    where: { shopId: session.shopId, categoryId: category.id, isDeleted: false },
    include: { category: true },
    orderBy: { name: "asc" },
  });

  const items = itemsRaw.map((item) => {
    const stock = Number(item.currentStock);
    const thresh = Number(item.minStockThreshold);
    return {
      id: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      currentStock: stock,
      minStockThreshold: thresh,
      purchasePrice: item.purchasePrice ? Number(item.purchasePrice) : null,
      sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : null,
      categoryName: item.category.name,
      categoryId: item.categoryId,
      isLowStock: stock <= thresh,
      isOutOfStock: stock <= 0,
    };
  });

  return <CategoryDetailView category={category} items={items} />;
}

export default async function CategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <Suspense fallback={<CategorySkeleton />}>
        <CategoryContent categoryId={categoryId} />
      </Suspense>
    </div>
  );
}
