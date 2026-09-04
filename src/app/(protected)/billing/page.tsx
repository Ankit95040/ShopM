import { Suspense } from "react";
import { getLocationsAction } from "@/server/actions/location.actions";
import { getShopBillingSummary } from "@/server/actions/billing.actions";
import { LocationCards } from "@/components/billing/LocationCards";

export const dynamic = "force-dynamic";

function BillingSkeleton() {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-slate-100 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

async function BillingContent() {
  const [res, billingSummary] = await Promise.all([
    getLocationsAction(),
    getShopBillingSummary(),
  ]);
  const locations = res.success && res.locations ? res.locations : [];

  return (
    <LocationCards
      initialLocations={locations}
      shopBillingSummary={billingSummary}
    />
  );
}

export default function BillingPage() {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto min-w-0">
      <Suspense fallback={<BillingSkeleton />}>
        <BillingContent />
      </Suspense>
    </div>
  );
}
