import { getLocationsAction } from "@/server/actions/location.actions";
import { LocationCards } from "@/components/billing/LocationCards";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const res = await getLocationsAction();
  const locations = res.success && res.locations ? res.locations : [];

  let userId = "usr_default_01";
  try {
    const user = await db.user.findFirst();
    if (user) userId = user.id;
  } catch (error) {
    console.error("Failed to fetch user:", error);
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <LocationCards initialLocations={locations} userId={userId} />
    </div>
  );
}
