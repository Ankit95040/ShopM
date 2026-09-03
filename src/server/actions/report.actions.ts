"use server";

import { withPerformance } from "@/lib/performance";
import { db } from "@/server/db";
import { requireAuth } from "@/server/auth";
import { calculatePeriodReport, getPeriodDates, PeriodReport } from "@/lib/accounting";

export interface ReportCustomer {
  id: string;
  name: string;
  phone: string;
  locationName: string;
  totalDebt: number;
  totalReceived: number;
  outstandingBalance: number;
}

export interface ReportTransaction {
  id: string;
  type: "DEBT" | "PAYMENT_RECEIVED";
  amount: number;
  transactionDate: Date;
  customerName: string;
  customerId: string;
  locationName: string;
  createdByName: string;
  billNumber?: string | null;
  paymentMethod?: string | null;
  description?: string | null;
  billImageKey?: string | null;
  customerIdForImage?: string;
}

export interface InventoryPeriodReport {
  openingStock: number;
  stockIn: number;
  stockOut: number;
  closingStock: number;
  totalItems: number;
}

export interface ReportData {
  periodReport: PeriodReport;
  inventoryReport: InventoryPeriodReport;
  customers: ReportCustomer[];
  transactions: ReportTransaction[];
  availableMonths: Array<{ key: string; label: string }>;
}

async function getReportDataImpl(params?: {
  month?: string;
  customerId?: string;
}): Promise<ReportData> {
  const session = await requireAuth();

  const activeCustomerIds = await db.customer.findMany({
    where: { shopId: session.shopId, isDeleted: false },
    select: { id: true },
  });
  const ids = activeCustomerIds.map((c) => c.id);

  // Fetch all non-deleted transactions for this shop
  const allTransactions = ids.length > 0
    ? await db.transaction.findMany({
        where: {
          shopId: session.shopId,
          isDeleted: false,
          customerId: { in: ids },
        },
        include: {
          customer: { select: { name: true, phone: true, locationId: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
      })
    : [];

  // Build available months from transactions
  const monthMap = new Map<string, string>();
  for (const tx of allTransactions) {
    const d = new Date(tx.transactionDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    if (!monthMap.has(key)) monthMap.set(key, label);
  }
  const availableMonths = Array.from(monthMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, label]) => ({ key, label }));

  // Apply customer filter
  let filteredTransactions = allTransactions;
  if (params?.customerId) {
    filteredTransactions = allTransactions.filter(
      (tx) => tx.customerId === params.customerId
    );
  }

  // Apply period filter and calculate period report
  const periodDates = params?.month ? getPeriodDates(params.month) : null;
  const txRecords = filteredTransactions.map((tx) => ({
    type: tx.type as "DEBT" | "PAYMENT_RECEIVED",
    amount: Number(tx.amount),
    transactionDate: tx.transactionDate,
  }));

  const periodReport = calculatePeriodReport(
    txRecords,
    periodDates?.start ?? null,
    periodDates?.end ?? null
  );

  // Calculate inventory period report
  const inventoryReport = await calculateInventoryPeriodReport(
    session.shopId,
    periodDates?.start ?? null,
    periodDates?.end ?? null
  );

  // Build customer summary (aggregated from all transactions, not period-filtered)
  const customerMap = new Map<string, ReportCustomer>();
  for (const tx of allTransactions) {
    const cid = tx.customerId;
    if (!customerMap.has(cid)) {
      customerMap.set(cid, {
        id: cid,
        name: tx.customer?.name || "Customer",
        phone: tx.customer?.phone || "",
        locationName: "",
        totalDebt: 0,
        totalReceived: 0,
        outstandingBalance: 0,
      });
    }
    const cust = customerMap.get(cid)!;
    const amt = Number(tx.amount);
    if (tx.type === "DEBT") cust.totalDebt += amt;
    else cust.totalReceived += amt;
  }

  // Fetch location names for customers
  const locationIds = new Set<string>();
  for (const cust of customerMap.values()) {
    const tx = allTransactions.find((t) => t.customerId === cust.id);
    if (tx?.customer?.locationId) {
      locationIds.add(tx.customer.locationId);
    }
  }

  const locations = await db.location.findMany({
    where: { id: { in: Array.from(locationIds) } },
    select: { id: true, name: true },
  });
  const locationMap = new Map(locations.map((l) => [l.id, l.name]));

  for (const cust of customerMap.values()) {
    const tx = allTransactions.find((t) => t.customerId === cust.id);
    if (tx?.customer?.locationId) {
      cust.locationName = locationMap.get(tx.customer.locationId) || "";
    }
    cust.outstandingBalance = cust.totalDebt - cust.totalReceived;
  }

  // Format transactions for report (include billImageKey for bill icon)
  const transactions: ReportTransaction[] = filteredTransactions.map((tx) => ({
    id: tx.id,
    type: tx.type as "DEBT" | "PAYMENT_RECEIVED",
    amount: Number(tx.amount),
    transactionDate: tx.transactionDate,
    customerName: tx.customer?.name || "Customer",
    customerId: tx.customerId,
    locationName: locationMap.get(tx.customer?.locationId || "") || "",
    createdByName: tx.createdBy?.name || "User",
    billNumber: tx.billNumber,
    paymentMethod: tx.paymentMethod,
    description: tx.description,
    billImageKey: tx.billImageKey,
    customerIdForImage: tx.customerId,
  }));

  return {
    periodReport,
    inventoryReport,
    customers: Array.from(customerMap.values()).sort(
      (a, b) => b.outstandingBalance - a.outstandingBalance
    ),
    transactions,
    availableMonths,
  };
}
export const getReportData = withPerformance("getReportData", "action", getReportDataImpl);

async function calculateInventoryPeriodReport(
  shopId: string,
  periodStart: Date | null,
  periodEnd: Date | null
): Promise<InventoryPeriodReport> {
  // Get all stock movements for this shop
  const allMovements = await db.stockMovement.findMany({
    where: { shopId },
    select: {
      type: true,
      quantity: true,
      movementDate: true,
    },
    orderBy: { movementDate: "asc" },
  });

  const totalItems = await db.inventoryItem.count({
    where: { shopId, isDeleted: false },
  });

  let openingStock = 0;
  let stockIn = 0;
  let stockOut = 0;

  const startMs = periodStart ? periodStart.getTime() : 0;
  const endMs = periodEnd ? periodEnd.getTime() : Infinity;

  for (const m of allMovements) {
    const mDate = new Date(m.movementDate).getTime();
    const qty = Number(m.quantity);

    // Count all movements for opening stock calculation
    if (!periodStart || mDate < startMs) {
      // Before period: count for opening stock
      if (m.type === "ADD_STOCK") openingStock += qty;
      else openingStock -= qty;
    } else if (mDate <= endMs) {
      // Within period
      if (m.type === "ADD_STOCK") stockIn += qty;
      else stockOut += qty;
    }
  }

  const closingStock = openingStock + stockIn - stockOut;

  return {
    openingStock,
    stockIn,
    stockOut,
    closingStock,
    totalItems,
  };
}
