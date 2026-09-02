import { getLocationsAction } from "@/server/actions/location.actions";
import { getShopBillingSummary } from "@/server/actions/billing.actions";
import { LocationCards } from "@/components/billing/LocationCards";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const [res, billingSummary] = await Promise.all([
    getLocationsAction(),
    getShopBillingSummary(),
  ]);
  const locations = res.success && res.locations ? res.locations : [];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <LocationCards
        initialLocations={locations}
        shopBillingSummary={billingSummary}
      />
    </div>
  );
}
