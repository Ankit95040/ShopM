import { getDeletedCustomersAction } from "@/server/actions/customer.actions";
import { RecycleBinView } from "@/components/billing/RecycleBinView";

export const dynamic = "force-dynamic";

export default async function RecycleBinPage() {
  const res = await getDeletedCustomersAction();
  const customers = res.success && res.customers ? res.customers : [];

  return <RecycleBinView initialCustomers={customers} />;
}
