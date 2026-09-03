"use server";

import { withPerformance } from "@/lib/performance";
import { db } from "@/server/db";
import { requireAuth, resolveSession } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { AuditAction, Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { createHash } from "crypto";

const SESSION_COOKIE = "shopm_session";
const GUEST_COOKIE = "shopm_guest";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Lightweight auth check — checks ALS cache first, then falls back to raw SQL.
 */
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
      { userId: string; shopId: string; shopMemberId: string; role: string; expiresAt: Date; shopActive: boolean; isDemo: boolean; demoExpiresAt: Date | null; memberActive: boolean; userActive: boolean }[]
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
      }
    }
  }

  const session = await requireAuth();
  return { userId: session.userId, shopId: session.shopId, shopMemberId: session.shopMemberId, role: session.role };
}

async function createCustomerActionImpl({
  locationId,
  name,
  phone,
  address,
}: {
  locationId: string;
  name: string;
  phone: string;
  address?: string;
}) {
  try {
    const session = await requireAuth();
    if (!name.trim() || !phone.trim()) {
      return { success: false, error: "Name and phone are required" };
    }

    const location = await db.location.findFirst({
      where: { id: locationId, shopId: session.shopId, isDeleted: false },
      select: { id: true },
    });
    if (!location) return { success: false, error: "Location not found" };

    const customer = await db.customer.create({
      data: {
        shopId: session.shopId,
        locationId,
        name: name.trim(),
        phone: phone.trim(),
        address: address?.trim() || null,
        createdById: session.userId,
      },
    });

    revalidatePath(`/billing/${locationId}`);
    revalidatePath("/billing");
    revalidatePath("/");
    revalidatePath("/reports");
    return { success: true, customer };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create customer" };
  }
}
export const createCustomerAction = withPerformance("createCustomerAction", "action", createCustomerActionImpl);

async function getCustomersByLocationActionImpl(locationId: string, search?: string) {
  try {
    const session = await requireAuth();
    const searchPattern = search?.trim() ? `%${search.trim()}%` : null;

    // Single SQL query: customer + aggregated transaction totals + createdBy name
    // Replaces Prisma nested include of ALL transactions per customer
    const rows = await db.$queryRaw<
      {
        id: string;
        name: string;
        phone: string;
        address: string | null;
        createdAt: Date;
        updatedAt: Date;
        createdByName: string;
        totalDebt: unknown;
        totalReceived: unknown;
        transactionCount: bigint;
        lastTransactionDate: Date | null;
      }[]
    >`
      SELECT c.id, c.name, c.phone, c.address, c."createdAt", c."updatedAt",
             u.name AS "createdByName",
             COALESCE(SUM(CASE WHEN t."type" = 'DEBT' THEN t.amount ELSE 0 END), 0) AS "totalDebt",
             COALESCE(SUM(CASE WHEN t."type" = 'PAYMENT_RECEIVED' THEN t.amount ELSE 0 END), 0) AS "totalReceived",
             COUNT(t.id)::bigint AS "transactionCount",
             MAX(t."transactionDate") AS "lastTransactionDate"
      FROM "Customer" c
      JOIN "User" u ON c."createdById" = u.id
      LEFT JOIN "Transaction" t ON t."customerId" = c.id AND t."isDeleted" = false
      WHERE c."shopId" = ${session.shopId} AND c."locationId" = ${locationId} AND c."isDeleted" = false
      ${searchPattern ? Prisma.sql`AND (c.name ILIKE ${searchPattern} OR c.phone LIKE ${searchPattern})` : Prisma.empty}
      GROUP BY c.id, c.name, c.phone, c.address, c."createdAt", c."updatedAt", u.name
      ORDER BY c.name ASC
    `;

    const customers = rows.map((r) => {
      const totalDebt = Number(r.totalDebt);
      const totalReceived = Number(r.totalReceived);
      return {
        id: r.id,
        name: r.name,
        phone: r.phone,
        address: r.address,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        createdByName: r.createdByName,
        totalDebt,
        totalReceived,
        outstandingBalance: totalDebt - totalReceived,
        transactionCount: Number(r.transactionCount),
        lastTransactionDate: r.lastTransactionDate,
      };
    });

    return { success: true, customers };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch customers" };
  }
}
export const getCustomersByLocationAction = withPerformance("getCustomersByLocationAction", "action", getCustomersByLocationActionImpl);

interface SerializedTransaction {
  id: string;
  type: "DEBT" | "PAYMENT_RECEIVED";
  amount: number;
  billNumber: string | null;
  paymentMethod: string | null;
  description: string | null;
  billImageUrl: string | null;
  transactionDate: Date;
  createdByName: string;
  updatedByName: string | undefined;
  updatedAt: Date;
}

async function getCustomerAccountDetailsActionImpl(customerId: string) {
  try {
    const session = await requireAuthBasic();

    // Q1: Auth (already done above — 1 raw SQL)

    // Q2: Customer + Location + createdBy via single JOIN query
    const customerRows = await db.$queryRaw<
      {
        id: string;
        name: string;
        phone: string;
        address: string | null;
        createdAt: Date;
        locationId: string;
        locationName: string;
        createdByName: string;
      }[]
    >`
      SELECT c."id", c."name", c."phone", c."address", c."createdAt",
             c."locationId", l."name" AS "locationName", u."name" AS "createdByName"
      FROM "Customer" c
      JOIN "Location" l ON c."locationId" = l."id"
      JOIN "User" u ON c."createdById" = u.id
      WHERE c."id" = ${customerId} AND c."shopId" = ${session.shopId} AND c."isDeleted" = false
      LIMIT 1
    `;

    if (customerRows.length === 0) return { success: false, error: "Customer not found" };
    const cust = customerRows[0];

    // Q3: Transactions with createdBy + updatedBy names via LEFT JOINs
    const txRows = await db.$queryRaw<
      {
        id: string;
        type: string;
        amount: unknown;
        billNumber: string | null;
        paymentMethod: string | null;
        description: string | null;
        billImageUrl: string | null;
        transactionDate: Date;
        updatedAt: Date;
        createdByName: string;
        updatedByName: string | null;
      }[]
    >`
      SELECT t."id", t."type"::text, t."amount", t."billNumber", t."paymentMethod",
             t."description", t."billImageUrl", t."transactionDate", t."updatedAt",
             cu."name" AS "createdByName",
             uu."name" AS "updatedByName"
      FROM "Transaction" t
      JOIN "User" cu ON t."createdById" = cu.id
      LEFT JOIN "User" uu ON t."updatedById" = uu.id
      WHERE t."customerId" = ${customerId} AND t."isDeleted" = false
      ORDER BY t."transactionDate" ASC
    `;

    let totalDebt = 0;
    let totalReceived = 0;

    const debtTransactions: SerializedTransaction[] = [];
    const paymentTransactions: SerializedTransaction[] = [];
    const allTransactions: SerializedTransaction[] = [];

    for (const t of txRows) {
      const amt = Number(t.amount);
      const item: SerializedTransaction = {
        id: t.id,
        type: t.type as "DEBT" | "PAYMENT_RECEIVED",
        amount: amt,
        billNumber: t.billNumber,
        paymentMethod: t.paymentMethod,
        description: t.description,
        billImageUrl: t.billImageUrl,
        transactionDate: t.transactionDate,
        createdByName: t.createdByName,
        updatedByName: t.updatedByName ?? undefined,
        updatedAt: t.updatedAt,
      };

      allTransactions.push(item);
      if (t.type === "DEBT") {
        totalDebt += amt;
        debtTransactions.push(item);
      } else {
        totalReceived += amt;
        paymentTransactions.push(item);
      }
    }

    const outstandingBalance = totalDebt - totalReceived;

    return {
      success: true,
      data: {
        customer: {
          id: cust.id,
          name: cust.name,
          phone: cust.phone,
          address: cust.address,
          createdAt: cust.createdAt,
          locationId: cust.locationId,
          locationName: cust.locationName,
          createdByName: cust.createdByName,
        },
        summary: {
          totalDebt,
          totalReceived,
          outstandingBalance,
          transactionCount: allTransactions.length,
          lastTransactionDate: allTransactions[allTransactions.length - 1]?.transactionDate || null,
        },
        debtTransactions,
        paymentTransactions,
        allTransactions,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch customer account" };
  }
}
export const getCustomerAccountDetailsAction = withPerformance("getCustomerAccountDetailsAction", "action", getCustomerAccountDetailsActionImpl);

async function softDeleteCustomerActionImpl(customerId: string) {
  try {
    const session = await requireAuth();

    const customer = await db.customer.findFirst({
      where: { id: customerId, shopId: session.shopId, isDeleted: false },
      select: { id: true, name: true, locationId: true },
    });
    if (!customer) return { success: false, error: "Customer not found" };

    const tx = await db.$transaction(async (prisma) => {
      const updated = await prisma.customer.update({
        where: { id: customerId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          shopId: session.shopId,
          userId: session.userId,
          action: AuditAction.DELETE,
          entityType: "CUSTOMER",
          entityId: customerId,
          previousValue: { name: customer.name },
          changeReason: "Customer soft-deleted by user",
        },
      });

      return updated;
    });

    revalidatePath(`/billing/${customer.locationId}`);
    revalidatePath("/billing");
    revalidatePath("/");
    revalidatePath("/reports");
    revalidatePath("/audit-logs");
    revalidatePath("/recycle-bin");

    return { success: true, customer: tx, locationId: customer.locationId };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete customer" };
  }
}
export const softDeleteCustomerAction = withPerformance("softDeleteCustomerAction", "action", softDeleteCustomerActionImpl);

async function restoreCustomerActionImpl(customerId: string) {
  try {
    const session = await requireAuth();

    const customer = await db.customer.findFirst({
      where: { id: customerId, shopId: session.shopId, isDeleted: true },
      select: { id: true, name: true, locationId: true },
    });
    if (!customer) return { success: false, error: "Customer not found or not deleted" };

    const location = await db.location.findFirst({
      where: { id: customer.locationId, shopId: session.shopId },
      select: { id: true, isDeleted: true },
    });
    if (!location) return { success: false, error: "Parent location not found" };

    const needsLocationRestore = location.isDeleted;

    const tx = await db.$transaction(async (prisma) => {
      if (needsLocationRestore) {
        await prisma.location.update({
          where: { id: customer.locationId },
          data: { isDeleted: false, deletedAt: null },
        });

        await prisma.auditLog.create({
          data: {
            shopId: session.shopId,
            userId: session.userId,
            action: AuditAction.RESTORE,
            entityType: "LOCATION",
            entityId: customer.locationId,
            previousValue: { isDeleted: true },
            newValue: { isDeleted: false },
            changeReason: "Location restored as parent of restored customer",
          },
        });
      }

      const updated = await prisma.customer.update({
        where: { id: customerId },
        data: {
          isDeleted: false,
          deletedAt: null,
        },
      });

      await prisma.auditLog.create({
        data: {
          shopId: session.shopId,
          userId: session.userId,
          action: AuditAction.RESTORE,
          entityType: "CUSTOMER",
          entityId: customerId,
          previousValue: { isDeleted: true },
          newValue: { isDeleted: false },
          changeReason: needsLocationRestore
            ? "Customer restored; parent location was also restored"
            : "Customer restored by user",
        },
      });

      return updated;
    });

    revalidatePath(`/billing/${customer.locationId}`);
    revalidatePath("/billing");
    revalidatePath("/");
    revalidatePath("/reports");
    revalidatePath("/audit-logs");
    revalidatePath("/recycle-bin");

    return { success: true, customer: tx };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to restore customer" };
  }
}
export const restoreCustomerAction = withPerformance("restoreCustomerAction", "action", restoreCustomerActionImpl);

async function getDeletedCustomersActionImpl() {
  try {
    const session = await requireAuth();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const deletedCustomers = await db.customer.findMany({
      where: {
        shopId: session.shopId,
        isDeleted: true,
        deletedAt: { not: null, gte: thirtyDaysAgo },
      },
      include: {
        location: { select: { name: true } },
      },
      orderBy: { deletedAt: "desc" },
    });

    const formatted = deletedCustomers.map((c) => {
      const deletedAt = c.deletedAt || c.createdAt;
      const expiresAt = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const daysRemaining = Math.max(
        0,
        Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      );

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        locationName: c.location.name,
        deletedAt: deletedAt,
        expiresAt: expiresAt,
        daysRemaining,
      };
    });

    return { success: true, customers: formatted };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch deleted customers" };
  }
}
export const getDeletedCustomersAction = withPerformance("getDeletedCustomersAction", "action", getDeletedCustomersActionImpl);
