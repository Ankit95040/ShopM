import { db } from "@/server/db";
import { DashboardView, DashboardMetrics } from "@/components/dashboard/DashboardView";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let userGreetingName = "Ankit";
  let totalCustomers = 0;
  let totalDebt = 0;
  let totalReceived = 0;
  let totalLocations = 0;
  let totalItems = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let recentTransactions: any[] = [];
  let recentMovements: any[] = [];
  let isDbConnected = true;

  try {
    const user = await db.user.findFirst();
    if (user?.name) {
      // Extract first name (e.g. "Ankit Raj (Shop Owner)" -> "Ankit" or "Ankit Raj" -> "Ankit")
      const cleanName = user.name.replace(/\(.*?\)/g, "").trim();
      userGreetingName = cleanName.split(" ")[0] || cleanName;
    }

    const [
      locations,
      customers,
      transactions,
      items,
      movements,
    ] = await Promise.all([
      db.location.findMany({ where: { isDeleted: false } }),
      db.customer.findMany({ where: { isDeleted: false } }),
      db.transaction.findMany({
        where: { isDeleted: false },
        include: {
          customer: { select: { name: true, phone: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { transactionDate: "desc" },
        take: 5,
      }),
      db.inventoryItem.findMany({ where: { isDeleted: false } }),
      db.stockMovement.findMany({
        include: {
          item: { select: { name: true, unit: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { movementDate: "desc" },
        take: 5,
      }),
    ]);

    totalLocations = locations.length;
    totalCustomers = customers.length;

    recentTransactions = transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      paymentMethod: t.paymentMethod,
      transactionDate: t.transactionDate,
      customerName: t.customer?.name || "Customer",
      createdByName: t.createdBy?.name || "User",
    }));

    recentMovements = movements.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: Number(m.quantity),
      removalReason: m.removalReason,
      movementDate: m.movementDate,
      itemName: m.item?.name || "Item",
      itemUnit: m.item?.unit || "Unit",
      createdByName: m.createdBy?.name || "User",
    }));

    totalItems = items.length;

    // Calculate Debt & Payments
    const allTxs = await db.transaction.findMany({
      where: { isDeleted: false },
      select: { type: true, amount: true },
    });

    for (const t of allTxs) {
      const amt = Number(t.amount);
      if (t.type === "DEBT") totalDebt += amt;
      else if (t.type === "PAYMENT_RECEIVED") totalReceived += amt;
    }

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

  const outstandingBalance = totalDebt - totalReceived;

  const dashboardData: DashboardMetrics = {
    userGreetingName,
    totalCustomers,
    totalDebt,
    totalReceived,
    outstandingBalance,
    totalLocations,
    totalItems,
    lowStockCount,
    outOfStockCount,
    isDbConnected,
    recentTransactions,
    recentMovements,
  };

  return <DashboardView data={dashboardData} />;
}
