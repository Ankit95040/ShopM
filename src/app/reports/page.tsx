import { db } from "@/server/db";
import { ReportsView, LocationReportItem, InventoryReportItem } from "@/components/reports/ReportsView";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  let locations: any[] = [];
  let items: any[] = [];

  try {
    [locations, items] = await Promise.all([
      db.location.findMany({
        where: { isDeleted: false },
        include: {
          customers: {
            where: { isDeleted: false },
            include: {
              transactions: {
                where: { isDeleted: false },
                select: { type: true, amount: true },
              },
            },
          },
        },
      }),
      db.inventoryItem.findMany({
        where: { isDeleted: false },
        include: { category: true },
      }),
    ]);
  } catch (error) {
    console.error("Reports DB fetch error:", error);
  }

  // Aggregate location breakdown
  const locationReport: LocationReportItem[] = locations.map((loc) => {
    let debt = 0;
    let rec = 0;
    for (const c of loc.customers) {
      for (const t of c.transactions) {
        const amt = Number(t.amount);
        if (t.type === "DEBT") debt += amt;
        else if (t.type === "PAYMENT_RECEIVED") rec += amt;
      }
    }
    return {
      id: loc.id,
      name: loc.name,
      customerCount: loc.customers.length,
      debt,
      received: rec,
      balance: debt - rec,
    };
  });

  const serializedItems: InventoryReportItem[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    currentStock: Number(i.currentStock),
    purchasePrice: i.purchasePrice ? Number(i.purchasePrice) : null,
    categoryName: i.category?.name || "General",
  }));

  const totalValuation = items.reduce(
    (acc, i) => acc + Number(i.currentStock) * (Number(i.purchasePrice) || 0),
    0
  );

  return (
    <ReportsView
      locationReport={locationReport}
      items={serializedItems}
      totalValuation={totalValuation}
    />
  );
}
