import { db } from "@/server/db";
import { getCustomerAccountDetailsAction } from "@/server/actions/customer.actions";
import { CustomerLedgerView } from "@/components/billing/CustomerLedgerView";

export const dynamic = "force-dynamic";

export default async function CustomerLedgerPage({
  params,
}: {
  params: Promise<{ locationId: string; customerId: string }>;
}) {
  const { locationId, customerId } = await params;

  let userId = "usr_default_01";
  try {
    const user = await db.user.findFirst();
    if (user) userId = user.id;
  } catch (error) {
    console.error("Failed to fetch user:", error);
  }

  const res = await getCustomerAccountDetailsAction(customerId);

  if (!res.success || !res.data) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Customer account not found</h2>
        <p className="text-xs text-slate-500">{res.error || "Please verify customer ID"}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <CustomerLedgerView initialData={res.data as any} userId={userId} />
    </div>
  );
}
