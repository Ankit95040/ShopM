"use server";

import { cookies } from "next/headers";
import { createHash } from "crypto";
import { withPerformance } from "@/lib/performance";
import { db } from "@/server/db";
import { resolveSession } from "@/server/auth";

const SESSION_COOKIE = "shopm_session";
const GUEST_COOKIE = "shopm_guest";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function requireAuthBasic(): Promise<{
  userId: string;
  shopId: string;
  shopMemberId: string;
  role: string;
}> {
  // Check ALS cache first — layout already resolved auth for this request
  const cached = await resolveSession();
  if (cached) {
    return { userId: cached.userId, shopId: cached.shopId, shopMemberId: cached.shopMemberId, role: cached.role };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const guestToken = cookieStore.get(GUEST_COOKIE)?.value;

  if (token) {
    const tokenHash = hashToken(token);
    const rows = await db.$queryRaw<
      { userId: string; shopId: string; shopMemberId: string; role: string; expiresAt: Date; userActive: boolean; shopActive: boolean; memberActive: boolean }[]
    >`
      SELECT s."userId", s."shopId", s."shopMemberId", s."expiresAt",
             u."isActive" AS "userActive",
             sh."isActive" AS "shopActive",
             sm."isActive" AS "memberActive", sm."role"
      FROM "AuthSession" s
      JOIN "User" u ON s."userId" = u.id
      JOIN "Shop" sh ON s."shopId" = sh.id
      JOIN "ShopMember" sm ON s."shopMemberId" = sm.id
      WHERE s."tokenHash" = ${tokenHash}
      LIMIT 1
    `;
    if (rows.length > 0) {
      const r = rows[0];
      if (r.expiresAt > new Date() && r.userActive && r.shopActive && r.memberActive) {
        return { userId: r.userId, shopId: r.shopId, shopMemberId: r.shopMemberId, role: r.role };
      }
      await db.authSession.deleteMany({ where: { tokenHash } }).catch(() => {});
    }
  }

  if (guestToken) {
    const guestHash = hashToken(guestToken);
    const guestRows = await db.$queryRaw<
      { shopId: string; expiresAt: Date; shopActive: boolean; isDemo: boolean; demoExpiresAt: Date | null; userId: string; shopMemberId: string; role: string; memberActive: boolean; userActive: boolean }[]
    >`
      SELECT gs."shopId", gs."expiresAt",
             sh."isActive" AS "shopActive", sh."isDemo", sh."demoExpiresAt",
             sm."userId", sm.id AS "shopMemberId", sm."role", sm."isActive" AS "memberActive",
             u."isActive" AS "userActive"
      FROM "GuestSession" gs
      JOIN "Shop" sh ON gs."shopId" = sh.id
      JOIN "ShopMember" sm ON gs."shopId" = sm."shopId"
      JOIN "User" u ON sm."userId" = u.id
      WHERE gs."tokenHash" = ${guestHash}
      ORDER BY sm."createdAt" ASC
      LIMIT 1
    `;
    if (guestRows.length > 0) {
      const r = guestRows[0];
      const now = new Date();
      if (r.expiresAt > now && r.shopActive && r.isDemo && r.memberActive && r.userActive) {
        if (!r.demoExpiresAt || r.demoExpiresAt > now) {
          return { userId: r.userId, shopId: r.shopId, shopMemberId: r.shopMemberId, role: r.role };
        }
        await db.guestSession.deleteMany({ where: { tokenHash: guestHash } }).catch(() => {});
      }
    }
  }

  throw new Error("Unauthorized");
}

export interface ShopBillingSummary {
  totalDebt: number;
  totalReceived: number;
  outstandingBalance: number;
  totalCustomerCount: number;
}

export interface MonthlyBillingSummary {
  openingOutstanding: number;
  billsThisMonth: number;
  paymentsThisMonth: number;
  currentOutstanding: number;
  totalCustomerCount: number;
}

async function getShopBillingSummaryImpl(): Promise<ShopBillingSummary> {
  const session = await requireAuthBasic();

  const rows = await db.$queryRaw<
    { totalDebt: unknown; totalReceived: unknown; totalCustomerCount: bigint }[]
  >`
    SELECT
      COALESCE(SUM(CASE WHEN t."type" = 'DEBT' THEN t."amount" ELSE 0 END), 0) AS "totalDebt",
      COALESCE(SUM(CASE WHEN t."type" = 'PAYMENT_RECEIVED' THEN t."amount" ELSE 0 END), 0) AS "totalReceived",
      COUNT(DISTINCT c.id) AS "totalCustomerCount"
    FROM "Customer" c
    LEFT JOIN "Transaction" t ON t."customerId" = c.id
      AND t."isDeleted" = false
      AND t."shopId" = c."shopId"
    WHERE c."shopId" = ${session.shopId} AND c."isDeleted" = false
  `;

  const r = rows[0];
  const totalDebt = Number(r.totalDebt);
  const totalReceived = Number(r.totalReceived);

  return {
    totalDebt,
    totalReceived,
    outstandingBalance: totalDebt - totalReceived,
    totalCustomerCount: Number(r.totalCustomerCount),
  };
}
export const getShopBillingSummary = withPerformance("getShopBillingSummary", "action", getShopBillingSummaryImpl);

async function getMonthlyBillingSummaryImpl(): Promise<MonthlyBillingSummary> {
  const session = await requireAuthBasic();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Single SQL query — replaces fetching ALL transactions into Node.js
  const [rows, customerCount] = await Promise.all([
    db.$queryRaw<
      {
        totalDebt: unknown;
        totalReceived: unknown;
        billsThisMonth: unknown;
        paymentsThisMonth: unknown;
      }[]
    >`
      SELECT
        COALESCE(SUM(CASE WHEN t."type" = 'DEBT' THEN t.amount ELSE 0 END), 0) AS "totalDebt",
        COALESCE(SUM(CASE WHEN t."type" = 'PAYMENT_RECEIVED' THEN t.amount ELSE 0 END), 0) AS "totalReceived",
        COALESCE(SUM(CASE WHEN t."type" = 'DEBT' AND t."transactionDate" >= ${monthStart} THEN t.amount ELSE 0 END), 0) AS "billsThisMonth",
        COALESCE(SUM(CASE WHEN t."type" = 'PAYMENT_RECEIVED' AND t."transactionDate" >= ${monthStart} THEN t.amount ELSE 0 END), 0) AS "paymentsThisMonth"
      FROM "Transaction" t
      JOIN "Customer" c ON t."customerId" = c.id AND c."isDeleted" = false
      WHERE t."shopId" = ${session.shopId} AND t."isDeleted" = false
    `,
    db.customer.count({
      where: { shopId: session.shopId, isDeleted: false },
    }),
  ]);

  const r = rows[0];
  const totalDebt = Number(r.totalDebt);
  const totalReceived = Number(r.totalReceived);
  const billsThisMonth = Number(r.billsThisMonth);
  const paymentsThisMonth = Number(r.paymentsThisMonth);
  const currentOutstanding = totalDebt - totalReceived;
  const openingOutstanding = currentOutstanding - billsThisMonth + paymentsThisMonth;

  return {
    openingOutstanding,
    billsThisMonth,
    paymentsThisMonth,
    currentOutstanding,
    totalCustomerCount: customerCount,
  };
}
export const getMonthlyBillingSummary = withPerformance("getMonthlyBillingSummary", "action", getMonthlyBillingSummaryImpl);

