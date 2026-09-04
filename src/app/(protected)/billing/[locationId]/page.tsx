import { getCustomersByLocationAction } from "@/server/actions/customer.actions";
import { CustomerTable } from "@/components/billing/CustomerTable";
import { db } from "@/server/db";
import { getEffectiveSession } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function LocationCustomersPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;
  const session = await getEffectiveSession();
  if (!session) return null;

  let location = null;
  try {
    location = await db.location.findUnique({
      where: { id: locationId, shopId: session.shopId, isDeleted: false },
    });
  } catch (error) {
    console.error("Failed to fetch location:", error);
  }

  if (!location) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Location not found</h2>
        <p className="text-xs text-slate-500">Please make sure the location exists or database is migrated.</p>
      </div>
    );
  }

  const res = await getCustomersByLocationAction(locationId);
  const customers = res.success && res.customers ? res.customers : [];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto min-w-0">
      <CustomerTable
        initialCustomers={customers}
        locationId={locationId}
        locationName={location.name}
      />
    </div>
  );
}
