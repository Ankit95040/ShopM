import { Suspense } from "react";
import { db } from "@/server/db";
import { DashboardView, DashboardMetrics } from "@/components/dashboard/DashboardView";
import { getEffectiveSession } from "@/server/auth";
import { HomepageShell } from "@/components/shared/HomepageShell";
import { KeepDemoDataBanner } from "@/components/shared/KeepDemoDataBanner";

export const dynamic = "force-dynamic";

function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-64 bg-slate-200 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-100 rounded-2xl" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

async function DashboardContent({ session }: { session: { shopId: string; userName: string | null; isGuest?: boolean } }) {
  let totalItems = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let recentTransactions: DashboardMetrics["recentTransactions"] = [];
  let recentMovements: DashboardMetrics["recentMovements"] = [];
  let totalTransactionCount = 0;
  let totalMovementCount = 0;
  let isDbConnected = true;

  try {
    // Run all independent queries in parallel — no unbounded fetches
    const [
      tx10,
      mv10,
      inventoryStats,
      txCount,
      mvCount,
    ] = await Promise.all([
      // Recent 10 transactions (only what's shown on dashboard)
      db.transaction.findMany({
        where: {
          shopId: session.shopId,
          isDeleted: false,
          customer: { isDeleted: false },
        },
        include: {
          customer: { select: { name: true, phone: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
        take: 10,
      }),
      // Recent 10 movements (only what's shown on dashboard)
      db.stockMovement.findMany({
        where: { shopId: session.shopId },
        include: {
          item: { select: { name: true, unit: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { movementDate: "desc" },
        take: 10,
      }),
      // Inventory stats via SQL aggregate — no row transfer
      db.$queryRaw<
        { totalItems: bigint; lowStockCount: bigint; outOfStockCount: bigint }[]
      >`
        SELECT
          COUNT(*) AS "totalItems",
          COUNT(*) FILTER (WHERE "currentStock" > 0 AND "currentStock" <= "minStockThreshold") AS "lowStockCount",
          COUNT(*) FILTER (WHERE "currentStock" <= 0) AS "outOfStockCount"
        FROM "InventoryItem"
        WHERE "shopId" = ${session.shopId} AND "isDeleted" = false
      `,
      // Total transaction count for "View All" button visibility
      db.transaction.count({
        where: {
          shopId: session.shopId,
          isDeleted: false,
          customer: { isDeleted: false },
        },
      }),
      // Total movement count for "View All" button visibility
      db.stockMovement.count({
        where: { shopId: session.shopId },
      }),
    ]);

    recentTransactions = tx10.map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      paymentMethod: t.paymentMethod,
      transactionDate: t.transactionDate,
      customerName: t.customer?.name || "Customer",
      customerId: t.customerId,
      createdByName: t.createdBy?.name || "User",
      billImageKey: t.billImageKey,
    }));

    recentMovements = mv10.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: Number(m.quantity),
      removalReason: m.removalReason,
      movementDate: m.movementDate,
      itemName: m.item?.name || "Item",
      itemUnit: m.item?.unit || "Unit",
      createdByName: m.createdBy?.name || "User",
    }));

    const stats = inventoryStats[0];
    totalItems = Number(stats.totalItems);
    lowStockCount = Number(stats.lowStockCount);
    outOfStockCount = Number(stats.outOfStockCount);
    totalTransactionCount = txCount;
    totalMovementCount = mvCount;
  } catch (error) {
    isDbConnected = false;
    console.error("[DashboardPage] Database query error:", error);
  }

  const isGuest = (session as { isGuest?: boolean }).isGuest;
  const cleanName = isGuest ? "" : (session.userName ?? "User").replace(/\(.*?\)/g, "").trim();
  const userGreetingName = isGuest ? "" : cleanName.split(" ")[0] || cleanName;

  const dashboardData: DashboardMetrics = {
    userGreetingName,
    totalItems,
    lowStockCount,
    outOfStockCount,
    isDbConnected,
    recentTransactions,
    recentMovements,
    totalTransactionCount,
    totalMovementCount,
  };

  return <DashboardView data={dashboardData} />;
}

export default async function DashboardPage() {
  const session = await getEffectiveSession();
  if (!session) return null;

  return (
    <HomepageShell>
      <KeepDemoDataBanner />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent session={session} />
      </Suspense>
    </HomepageShell>
  );
}
