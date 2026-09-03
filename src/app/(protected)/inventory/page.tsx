import { Suspense } from "react";
import { getInventoryAction } from "@/server/actions/inventory.actions";
import { InventoryDashboard } from "@/components/inventory/InventoryDashboard";

export const dynamic = "force-dynamic";

function InventorySkeleton() {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-10 w-32 bg-slate-200 rounded-lg" />
          <div className="h-10 w-32 bg-slate-200 rounded-lg" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

async function InventoryContent() {
  const res = await getInventoryAction();
  const items = res.success && res.items ? res.items : [];
  const categories = res.success && res.categories ? res.categories : [];

  return (
    <InventoryDashboard
      initialItems={items}
      initialCategories={categories}
    />
  );
}

export default function InventoryPage() {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <Suspense fallback={<InventorySkeleton />}>
        <InventoryContent />
      </Suspense>
    </div>
  );
}
