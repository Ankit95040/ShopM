import { getInventoryAction } from "@/server/actions/inventory.actions";
import { InventoryDashboard } from "@/components/inventory/InventoryDashboard";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const res = await getInventoryAction();
  const items = res.success && res.items ? res.items : [];
  const categories = res.success && res.categories ? res.categories : [];

  let userId = "usr_default_01";
  try {
    const user = await db.user.findFirst();
    if (user) userId = user.id;
  } catch (error) {
    console.error("Failed to fetch user:", error);
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <InventoryDashboard
        initialItems={items as any}
        initialCategories={categories}
        userId={userId}
      />
    </div>
  );
}
