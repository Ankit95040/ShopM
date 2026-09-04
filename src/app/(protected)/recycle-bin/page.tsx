import { getDeletedCustomersAction } from "@/server/actions/customer.actions";
import { getDeletedInventoryItemsAction } from "@/server/actions/inventory.actions";
import { RecycleBinView } from "@/components/billing/RecycleBinView";

export const dynamic = "force-dynamic";

export default async function RecycleBinPage() {
  const [custRes, invRes] = await Promise.all([getDeletedCustomersAction(), getDeletedInventoryItemsAction()]);
  const customers = custRes.success && custRes.customers ? custRes.customers : [];
  const inventoryItems = invRes.success && invRes.items ? invRes.items : [];

  return <RecycleBinView initialCustomers={customers} initialInventoryItems={inventoryItems} />;
}
