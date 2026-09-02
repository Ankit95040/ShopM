import { getInventoryAction } from "@/server/actions/inventory.actions";
import { InventoryDashboard } from "@/components/inventory/InventoryDashboard";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const res = await getInventoryAction();
  const items = res.success && res.items ? res.items : [];
  const categories = res.success && res.categories ? res.categories : [];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <InventoryDashboard
        initialItems={items}
        initialCategories={categories}
      />
    </div>
  );
}
