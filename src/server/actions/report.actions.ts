"use server";

import { withPerformance } from "@/lib/performance";
import { db } from "@/server/db";
import { requireAuth } from "@/server/auth";
import { calculatePeriodReport, getPeriodDates, PeriodReport } from "@/lib/accounting";
import { Prisma } from "@prisma/client";

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
  const periodDates = params?.month ? getPeriodDates(params.month) : null;

  // Run all independent queries in parallel:
  // 1. Transactions with customer + location + createdBy via single JOIN query
  // 2. Inventory period report (SQL aggregate)
  // 3. Customer summary (SQL aggregate)
  const [txRows, inventoryReport, customerRows] = await Promise.all([
    // Q1: All transactions with joined customer, location, and createdBy data
    db.$queryRaw<
      {
        id: string;
        type: string;
        amount: unknown;
        transactionDate: Date;
        customerId: string;
        customerName: string;
        customerPhone: string;
        locationId: string;
        locationName: string;
        createdByName: string;
        billNumber: string | null;
        paymentMethod: string | null;
        description: string | null;
        billImageKey: string | null;
      }[]
    >`
      SELECT t.id, t."type"::text, t.amount, t."transactionDate",
             t."customerId",
             c.name AS "customerName", c.phone AS "customerPhone",
             c."locationId", l.name AS "locationName",
             u.name AS "createdByName",
             t."billNumber", t."paymentMethod"::text, t.description, t."billImageKey"
      FROM "Transaction" t
      JOIN "Customer" c ON t."customerId" = c.id AND c."isDeleted" = false
      JOIN "Location" l ON c."locationId" = l.id
      JOIN "User" u ON t."createdById" = u.id
      WHERE t."shopId" = ${session.shopId} AND t."isDeleted" = false
      ${params?.customerId ? Prisma.sql`AND t."customerId" = ${params.customerId}` : Prisma.empty}
      ORDER BY t."transactionDate" DESC, t.id DESC
    `,
    // Q2: Inventory period report via SQL conditional aggregation
    calculateInventoryPeriodReportSQL(session.shopId, periodDates?.start ?? null, periodDates?.end ?? null),
    // Q3: Customer summary via SQL aggregation
    db.$queryRaw<
      {
        id: string;
        name: string;
        phone: string;
        locationName: string;
        totalDebt: unknown;
        totalReceived: unknown;
      }[]
    >`
      SELECT c.id, c.name, c.phone,
             l.name AS "locationName",
             COALESCE(SUM(CASE WHEN t."type" = 'DEBT' THEN t.amount ELSE 0 END), 0) AS "totalDebt",
             COALESCE(SUM(CASE WHEN t."type" = 'PAYMENT_RECEIVED' THEN t.amount ELSE 0 END), 0) AS "totalReceived"
      FROM "Customer" c
      JOIN "Location" l ON c."locationId" = l.id
      LEFT JOIN "Transaction" t ON t."customerId" = c.id AND t."isDeleted" = false
      WHERE c."shopId" = ${session.shopId} AND c."isDeleted" = false
      GROUP BY c.id, c.name, c.phone, l.name
    `,
  ]);

  // Build available months from transactions
  const monthMap = new Map<string, string>();
  for (const tx of txRows) {
    const d = new Date(tx.transactionDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    if (!monthMap.has(key)) monthMap.set(key, label);
  }
  const availableMonths = Array.from(monthMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, label]) => ({ key, label }));

  // Calculate period report using the accounting module (preserves exact logic)
  const txRecords = txRows.map((tx) => ({
    type: tx.type as "DEBT" | "PAYMENT_RECEIVED",
    amount: Number(tx.amount),
    transactionDate: tx.transactionDate,
  }));

  const periodReport = calculatePeriodReport(
    txRecords,
    periodDates?.start ?? null,
    periodDates?.end ?? null
  );

  // Format customer summary
  const customers: ReportCustomer[] = customerRows
    .map((c) => {
      const totalDebt = Number(c.totalDebt);
      const totalReceived = Number(c.totalReceived);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        locationName: c.locationName,
        totalDebt,
        totalReceived,
        outstandingBalance: totalDebt - totalReceived,
      };
    })
    .sort((a, b) => b.outstandingBalance - a.outstandingBalance);

  // Format transactions for report
  const transactions: ReportTransaction[] = txRows.map((tx) => ({
    id: tx.id,
    type: tx.type as "DEBT" | "PAYMENT_RECEIVED",
    amount: Number(tx.amount),
    transactionDate: tx.transactionDate,
    customerName: tx.customerName || "Customer",
    customerId: tx.customerId,
    locationName: tx.locationName || "",
    createdByName: tx.createdByName || "User",
    billNumber: tx.billNumber,
    paymentMethod: tx.paymentMethod,
    description: tx.description,
    billImageKey: tx.billImageKey,
    customerIdForImage: tx.customerId,
  }));

  return {
    periodReport,
    inventoryReport,
    customers,
    transactions,
    availableMonths,
  };
}
export const getReportData = withPerformance("getReportData", "action", getReportDataImpl);

/**
 * Inventory period report via SQL conditional aggregation.
 * Replaces the old approach of loading ALL stock movements into Node.js.
 */
async function calculateInventoryPeriodReportSQL(
  shopId: string,
  periodStart: Date | null,
  periodEnd: Date | null
): Promise<InventoryPeriodReport> {
  // Run both queries in parallel
  const [movementAgg, totalItems] = await Promise.all([
    periodStart
      ? db.$queryRaw<
          { openingStock: unknown; stockIn: unknown; stockOut: unknown }[]
        >`
          SELECT
            COALESCE(SUM(CASE
              WHEN "movementDate" < ${periodStart} THEN
                CASE WHEN "type" = 'ADD_STOCK' THEN "quantity" ELSE -"quantity" END
              ELSE 0
            END), 0) AS "openingStock",
            COALESCE(SUM(CASE
              WHEN "movementDate" >= ${periodStart} AND "movementDate" <= ${periodEnd ?? new Date('9999-12-31')} AND "type" = 'ADD_STOCK' THEN "quantity"
              ELSE 0
            END), 0) AS "stockIn",
            COALESCE(SUM(CASE
              WHEN "movementDate" >= ${periodStart} AND "movementDate" <= ${periodEnd ?? new Date('9999-12-31')} AND "type" = 'REMOVE_STOCK' THEN "quantity"
              ELSE 0
            END), 0) AS "stockOut"
          FROM "StockMovement"
          WHERE "shopId" = ${shopId}
        `
      : db.$queryRaw<
          { openingStock: unknown; stockIn: unknown; stockOut: unknown }[]
        >`
          SELECT
            0 AS "openingStock",
            COALESCE(SUM(CASE WHEN "type" = 'ADD_STOCK' THEN "quantity" ELSE 0 END), 0) AS "stockIn",
            COALESCE(SUM(CASE WHEN "type" = 'REMOVE_STOCK' THEN "quantity" ELSE 0 END), 0) AS "stockOut"
          FROM "StockMovement"
          WHERE "shopId" = ${shopId}
        `,
    db.inventoryItem.count({ where: { shopId, isDeleted: false } }),
  ]);

  const agg = movementAgg[0];
  const openingStock = Number(agg.openingStock);
  const stockIn = Number(agg.stockIn);
  const stockOut = Number(agg.stockOut);

  return {
    openingStock,
    stockIn,
    stockOut,
    closingStock: openingStock + stockIn - stockOut,
    totalItems,
  };
}
