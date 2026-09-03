import { db } from "@/server/db";
import { DashboardView, DashboardMetrics } from "@/components/dashboard/DashboardView";
import { getEffectiveSession } from "@/server/auth";
import { HomepageShell } from "@/components/shared/HomepageShell";
import { KeepDemoDataBanner } from "@/components/shared/KeepDemoDataBanner";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getEffectiveSession();
  if (!session) return null;
  const cleanName = (session.userName ?? "User").replace(/\(.*?\)/g, "").trim();
  const userGreetingName = cleanName.split(" ")[0] || cleanName;
  let totalItems = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let recentTransactions: DashboardMetrics["recentTransactions"] = [];
  let allTransactions: DashboardMetrics["allTransactions"] = [];
  let recentMovements: DashboardMetrics["recentMovements"] = [];
  let allMovements: DashboardMetrics["allMovements"] = [];
  let isDbConnected = true;

  try {
    const activeCustomerIds = await db.customer.findMany({
      where: { shopId: session.shopId, isDeleted: false },
      select: { id: true },
    });
    const activeIds = activeCustomerIds.map((c) => c.id);

    const [tx10, txAll, locations, items, mv10, mvAll] =
      await Promise.all([
        // 10 most recent transactions for dashboard summary
        activeIds.length > 0
          ? db.transaction.findMany({
              where: {
                shopId: session.shopId,
                isDeleted: false,
                customerId: { in: activeIds },
              },
              include: {
                customer: { select: { name: true, phone: true } },
                createdBy: { select: { name: true } },
              },
              orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
              take: 10,
            })
          : Promise.resolve([]),
        // All transactions for View All modal
        activeIds.length > 0
          ? db.transaction.findMany({
              where: {
                shopId: session.shopId,
                isDeleted: false,
                customerId: { in: activeIds },
              },
              include: {
                customer: { select: { name: true, phone: true } },
                createdBy: { select: { name: true } },
              },
              orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
            })
          : Promise.resolve([]),
        db.location.findMany({ where: { shopId: session.shopId, isDeleted: false } }),
        db.inventoryItem.findMany({ where: { shopId: session.shopId, isDeleted: false } }),
        // 10 most recent stock movements for dashboard summary
        db.stockMovement.findMany({
          where: { shopId: session.shopId },
          include: {
            item: { select: { name: true, unit: true } },
            createdBy: { select: { name: true } },
          },
          orderBy: { movementDate: "desc" },
          take: 10,
        }),
        // All stock movements for View All modal
        db.stockMovement.findMany({
          where: { shopId: session.shopId },
          include: {
            item: { select: { name: true, unit: true } },
            createdBy: { select: { name: true } },
          },
          orderBy: { movementDate: "desc" },
        }),
      ]);

    void locations;

    const mapTx = (t: typeof tx10[number]) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      paymentMethod: t.paymentMethod,
      transactionDate: t.transactionDate,
      customerName: t.customer?.name || "Customer",
      customerId: t.customerId,
      createdByName: t.createdBy?.name || "User",
      billImageKey: t.billImageKey,
    });

    recentTransactions = tx10.map(mapTx);
    allTransactions = txAll.map(mapTx);

    const mapMv = (m: typeof mv10[number]) => ({
      id: m.id,
      type: m.type,
      quantity: Number(m.quantity),
      removalReason: m.removalReason,
      movementDate: m.movementDate,
      itemName: m.item?.name || "Item",
      itemUnit: m.item?.unit || "Unit",
      createdByName: m.createdBy?.name || "User",
    });

    recentMovements = mv10.map(mapMv);
    allMovements = mvAll.map(mapMv);

    totalItems = items.length;

    for (const item of items) {
      const stock = Number(item.currentStock);
      const thresh = Number(item.minStockThreshold);
      if (stock <= 0) outOfStockCount++;
      else if (stock <= thresh) lowStockCount++;
    }
  } catch (error) {
    isDbConnected = false;
    console.error("[DashboardPage] Database query error:", error);
  }

  const dashboardData: DashboardMetrics = {
    userGreetingName,
    totalItems,
    lowStockCount,
    outOfStockCount,
    isDbConnected,
    recentTransactions,
    allTransactions,
    recentMovements,
    allMovements,
  };

  return (
    <HomepageShell>
      <KeepDemoDataBanner />
      <DashboardView data={dashboardData} />
    </HomepageShell>
  );
}
