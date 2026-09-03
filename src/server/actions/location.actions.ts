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
 * Same security guarantees as requireAuth().
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

  // Guest session — single JOIN query
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

  // Fallback — handles guest session creation + cookie setting
  const session = await requireAuth();
  return { userId: session.userId, shopId: session.shopId, shopMemberId: session.shopMemberId, role: session.role };
}

async function createLocationActionImpl({
  name,
  description,
}: {
  name: string;
  description?: string;
}) {
  try {
    const session = await requireAuth();
    if (!name.trim()) return { success: false, error: "Location name is required" };

    const location = await db.location.create({
      data: {
        shopId: session.shopId,
        name: name.trim(),
        description: description?.trim() || null,
        createdById: session.userId,
      },
    });

    revalidatePath("/billing");
    revalidatePath("/");
    return { success: true, location };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create location" };
  }
}
export const createLocationAction = withPerformance("createLocationAction", "action", createLocationActionImpl);

async function getLocationsActionImpl(search?: string) {
  try {
    const session = await requireAuthBasic();

    // Single raw SQL query: Location + createdBy name + customer count + transaction aggregates
    // Replaces 4 separate Prisma include queries (Location, Customer, Transaction, User)
    const searchPattern = search?.trim() ? `%${search.trim()}%` : null;

    const rows = await db.$queryRaw<
      {
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        createdByName: string;
        customerCount: bigint;
        totalDebt: unknown;
        totalReceived: unknown;
      }[]
    >`
      SELECT
        l."id",
        l."name",
        l."description",
        l."createdAt",
        u."name" AS "createdByName",
        COALESCE(cust_counts.cnt, 0) AS "customerCount",
        COALESCE(tx_agg.total_debt, 0) AS "totalDebt",
        COALESCE(tx_agg.total_received, 0) AS "totalReceived"
      FROM "Location" l
      JOIN "User" u ON l."createdById" = u.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::bigint AS cnt
        FROM "Customer" c
        WHERE c."locationId" = l."id" AND c."isDeleted" = false
      ) cust_counts ON true
      LEFT JOIN LATERAL (
        SELECT
          SUM(CASE WHEN t."type" = 'DEBT' THEN t."amount" ELSE 0 END) AS total_debt,
          SUM(CASE WHEN t."type" = 'PAYMENT_RECEIVED' THEN t."amount" ELSE 0 END) AS total_received
        FROM "Transaction" t
        JOIN "Customer" c ON t."customerId" = c."id"
        WHERE c."locationId" = l."id" AND t."isDeleted" = false AND c."isDeleted" = false
      ) tx_agg ON true
      WHERE l."shopId" = ${session.shopId} AND l."isDeleted" = false
      ${searchPattern ? Prisma.sql`AND l."name" ILIKE ${searchPattern}` : Prisma.empty}
      ORDER BY l."createdAt" ASC
    `;

    const formatted = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      createdAt: r.createdAt,
      createdByName: r.createdByName,
      customerCount: Number(r.customerCount),
      totalDebt: Number(r.totalDebt),
      totalReceived: Number(r.totalReceived),
      outstandingBalance: Number(r.totalDebt) - Number(r.totalReceived),
    }));

    return { success: true, locations: formatted };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch locations" };
  }
}
export const getLocationsAction = withPerformance("getLocationsAction", "action", getLocationsActionImpl);

async function softDeleteLocationActionImpl(locationId: string) {
  try {
    const session = await requireAuth();

    const location = await db.location.findFirst({
      where: { id: locationId, shopId: session.shopId, isDeleted: false },
      select: { id: true, name: true },
    });
    if (!location) return { success: false, error: "Location not found" };

    const activeCustomers = await db.customer.findMany({
      where: { locationId, shopId: session.shopId, isDeleted: false },
      select: { id: true, name: true },
    });

    await db.$transaction(async (prisma) => {
      await prisma.location.update({
        where: { id: locationId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      if (activeCustomers.length > 0) {
        await prisma.customer.updateMany({
          where: { locationId, isDeleted: false },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          shopId: session.shopId,
          userId: session.userId,
          action: AuditAction.DELETE,
          entityType: "LOCATION",
          entityId: locationId,
          previousValue: {
            name: location.name,
            customerIds: activeCustomers.map((c) => c.id),
            customerNames: activeCustomers.map((c) => c.name),
          },
          changeReason: `Location deleted with ${activeCustomers.length} associated customer(s) archived`,
        },
      });
    });

    revalidatePath("/billing");
    revalidatePath("/");
    revalidatePath("/reports");
    revalidatePath("/audit-logs");
    revalidatePath("/recycle-bin");

    return {
      success: true,
      locationId,
      archivedCustomerIds: activeCustomers.map((c) => c.id),
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete location" };
  }
}
export const softDeleteLocationAction = withPerformance("softDeleteLocationAction", "action", softDeleteLocationActionImpl);

async function restoreLocationActionImpl(locationId: string) {
  try {
    const session = await requireAuth();

    const location = await db.location.findFirst({
      where: { id: locationId, shopId: session.shopId, isDeleted: true },
      select: { id: true, name: true, deletedAt: true },
    });
    if (!location) return { success: false, error: "Location not found or not deleted" };

    const locationDeletedAt = location.deletedAt || new Date();

    const customersToRestore = await db.customer.findMany({
      where: {
        locationId,
        shopId: session.shopId,
        isDeleted: true,
        deletedAt: { gte: locationDeletedAt },
      },
      select: { id: true, name: true },
    });

    await db.$transaction(async (prisma) => {
      await prisma.location.update({
        where: { id: locationId },
        data: {
          isDeleted: false,
          deletedAt: null,
        },
      });

      if (customersToRestore.length > 0) {
        await prisma.customer.updateMany({
          where: {
            id: { in: customersToRestore.map((c) => c.id) },
          },
          data: {
            isDeleted: false,
            deletedAt: null,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          shopId: session.shopId,
          userId: session.userId,
          action: AuditAction.RESTORE,
          entityType: "LOCATION",
          entityId: locationId,
          previousValue: { isDeleted: true },
          newValue: { isDeleted: false },
          changeReason: `Location restored with ${customersToRestore.length} associated customer(s)`,
        },
      });
    });

    revalidatePath("/billing");
    revalidatePath("/");
    revalidatePath("/reports");
    revalidatePath("/audit-logs");
    revalidatePath("/recycle-bin");

    return { success: true, locationId };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to restore location" };
  }
}
export const restoreLocationAction = withPerformance("restoreLocationAction", "action", restoreLocationActionImpl);
