import Link from "next/link";
import { getCustomerAccountDetailsAction } from "@/server/actions/customer.actions";
import { TransactionHistoryView } from "@/components/billing/TransactionHistoryView";

export const dynamic = "force-dynamic";

export default async function CustomerHistoryPage({
  params,
}: {
  params: Promise<{ locationId: string; customerId: string }>;
}) {
  const { locationId, customerId } = await params;

  const res = await getCustomerAccountDetailsAction(customerId);

  if (!res.success || !res.data) {
    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto min-w-0">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="text-base font-black text-slate-900">Customer not found</h2>
          <p className="text-xs text-slate-500 mt-1">{res.error || "Please verify customer ID"}</p>
          <Link href={`/billing/${locationId}`} className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
            Back to customers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-8 max-w-7xl mx-auto min-w-0">
      <TransactionHistoryView data={res.data} locationId={locationId} />
    </div>
  );
}
