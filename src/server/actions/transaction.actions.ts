"use server";

import { withPerformance } from "@/lib/performance";
import { db } from "@/server/db";
import { requireAuth, resolveSession } from "@/server/auth";
import { TransactionType, PaymentMethod, AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createHash } from "crypto";

const SESSION_COOKIE = "shopm_session";
const GUEST_COOKIE = "shopm_guest";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Lightweight auth check for transaction actions.
 * Checks ALS cache first (set by layout), then falls back to raw SQL.
 * Same security guarantees: token hash validation, isActive checks, tenant isolation.
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
      // Expired or inactive — clean up
      await db.authSession.deleteMany({ where: { tokenHash } }).catch(() => {});
    }
  }

  // Fall back to guest session — single JOIN query instead of Prisma includes
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

  // No valid session — use the standard requireAuth which handles guest creation
  const session = await requireAuth();
  return { userId: session.userId, shopId: session.shopId, shopMemberId: session.shopMemberId, role: session.role };
}

async function addDebtActionImpl({
  customerId,
  amount,
  billNumber,
  description,
  billImageUrl,
  billImagePublicId,
  transactionDate,
}: {
  customerId: string;
  amount: number;
  billNumber?: string;
  description?: string;
  billImageUrl?: string;
  billImagePublicId?: string;
  transactionDate?: Date | string;
}) {
  try {
    if (!amount || amount <= 0) {
      return { success: false, error: "Amount must be greater than zero" };
    }

    const session = await requireAuthBasic();

    const customer = await db.customer.findFirst({
      where: { id: customerId, shopId: session.shopId, isDeleted: false },
      select: { id: true, locationId: true },
    });
    if (!customer) return { success: false, error: "Customer not found" };

    const tx = await db.transaction.create({
      data: {
        shopId: session.shopId,
        customerId,
        type: TransactionType.DEBT,
        amount,
        billNumber: billNumber?.trim() || null,
        description: description?.trim() || null,
        billImageUrl: billImageUrl || null,
        billImagePublicId: billImagePublicId || null,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        createdById: session.userId,
      },
    });

    revalidatePath(`/billing/${customer.locationId}/customers/${customerId}`);
    revalidatePath(`/billing/${customer.locationId}`);
    revalidatePath("/billing");
    revalidatePath("/");
    revalidatePath("/reports");
    revalidatePath("/audit-logs");

    // Return plain serialized object without Decimal
    return {
      success: true,
      transaction: {
        id: tx.id,
        customerId: tx.customerId,
        type: tx.type,
        amount: Number(tx.amount),
        billNumber: tx.billNumber,
        paymentMethod: tx.paymentMethod,
        description: tx.description,
        billImageUrl: tx.billImageUrl,
        billImagePublicId: tx.billImagePublicId,
        billImageKey: tx.billImageKey,
        transactionDate: tx.transactionDate,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to add debt transaction" };
  }
}
export const addDebtAction = withPerformance("addDebtAction", "action", addDebtActionImpl);

async function addPaymentActionImpl({
  customerId,
  amount,
  paymentMethod,
  description,
  transactionDate,
}: {
  customerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  description?: string;
  transactionDate?: Date | string;
}) {
  try {
    const session = await requireAuth();
    if (!amount || amount <= 0) {
      return { success: false, error: "Amount must be greater than zero" };
    }

    const customer = await db.customer.findFirst({
      where: { id: customerId, shopId: session.shopId, isDeleted: false },
      select: { id: true, locationId: true },
    });
    if (!customer) return { success: false, error: "Customer not found" };

    const tx = await db.transaction.create({
      data: {
        shopId: session.shopId,
        customerId,
        type: TransactionType.PAYMENT_RECEIVED,
        amount,
        paymentMethod,
        description: description?.trim() || null,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        createdById: session.userId,
      },
    });

    revalidatePath(`/billing/${customer.locationId}/customers/${customerId}`);
    revalidatePath(`/billing/${customer.locationId}`);
    revalidatePath("/billing");
    revalidatePath("/");
    revalidatePath("/reports");
    revalidatePath("/audit-logs");

    // Return plain serialized object without Decimal
    return {
      success: true,
      transaction: {
        id: tx.id,
        customerId: tx.customerId,
        type: tx.type,
        amount: Number(tx.amount),
        billNumber: tx.billNumber,
        paymentMethod: tx.paymentMethod,
        description: tx.description,
        billImageUrl: tx.billImageUrl,
        billImagePublicId: tx.billImagePublicId,
        transactionDate: tx.transactionDate,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to add payment transaction" };
  }
}
export const addPaymentAction = withPerformance("addPaymentAction", "action", addPaymentActionImpl);

async function editTransactionActionImpl({
  transactionId,
  amount,
  billNumber,
  paymentMethod,
  description,
  billImageUrl,
  billImageKey,
  changeReason,
}: {
  transactionId: string;
  amount: number;
  billNumber?: string;
  paymentMethod?: PaymentMethod;
  description?: string;
  billImageUrl?: string;
  billImageKey?: string | null;
  changeReason: string;
}) {
  try {
    const session = await requireAuth();
    if (!changeReason?.trim()) {
      return { success: false, error: "Change reason is mandatory for financial audits" };
    }

    const oldTx = await db.transaction.findFirstOrThrow({
      where: { id: transactionId, shopId: session.shopId, isDeleted: false },
    });

    const updatedTx = await db.$transaction(async (prisma) => {
      const updated = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          amount,
          billNumber: billNumber?.trim() || null,
          paymentMethod: paymentMethod || null,
          description: description?.trim() || null,
          billImageUrl: billImageUrl !== undefined ? billImageUrl : oldTx.billImageUrl,
          billImageKey: billImageKey !== undefined ? billImageKey : oldTx.billImageKey,
          updatedById: session.userId,
        },
      });

      // Write immutable audit log
      await prisma.auditLog.create({
        data: {
          shopId: session.shopId,
          userId: session.userId,
          action: AuditAction.UPDATE,
          entityType: "TRANSACTION",
          entityId: transactionId,
          transactionId,
          previousValue: {
            amount: Number(oldTx.amount),
            type: oldTx.type,
            billNumber: oldTx.billNumber,
            description: oldTx.description,
            paymentMethod: oldTx.paymentMethod,
          },
          newValue: {
            amount,
            billNumber: billNumber?.trim() || null,
            description: description?.trim() || null,
            paymentMethod: paymentMethod || null,
          },
          changeReason: changeReason.trim(),
        },
      });

      return updated;
    });

    const cust = await db.customer.findUnique({
      where: { id: oldTx.customerId },
      select: { locationId: true },
    });

    if (cust) {
      revalidatePath(`/billing/${cust.locationId}/customers/${oldTx.customerId}`);
      revalidatePath(`/billing/${cust.locationId}`);
    }
    revalidatePath("/billing");
    revalidatePath("/");
    revalidatePath("/reports");
    revalidatePath("/audit-logs");

    return {
      success: true,
      transaction: {
        id: updatedTx.id,
        customerId: updatedTx.customerId,
        type: updatedTx.type,
        amount: Number(updatedTx.amount),
        billNumber: updatedTx.billNumber,
        paymentMethod: updatedTx.paymentMethod,
        description: updatedTx.description,
        billImageUrl: updatedTx.billImageUrl,
        billImageKey: updatedTx.billImageKey,
        transactionDate: updatedTx.transactionDate,
        createdAt: updatedTx.createdAt,
        updatedAt: updatedTx.updatedAt,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to edit transaction" };
  }
}
export const editTransactionAction = withPerformance("editTransactionAction", "action", editTransactionActionImpl);

async function softDeleteTransactionActionImpl({
  transactionId,
  reason,
}: {
  transactionId: string;
  reason: string;
}) {
  try {
    const session = await requireAuth();
    const oldTx = await db.transaction.findFirstOrThrow({
      where: { id: transactionId, shopId: session.shopId, isDeleted: false },
    });

    await db.$transaction(async (prisma) => {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedById: session.userId,
        },
      });

      await prisma.auditLog.create({
        data: {
          shopId: session.shopId,
          userId: session.userId,
          action: AuditAction.DELETE,
          entityType: "TRANSACTION",
          entityId: transactionId,
          transactionId,
          previousValue: {
            amount: Number(oldTx.amount),
            type: oldTx.type,
            description: oldTx.description,
          },
          changeReason: reason || "Soft-deleted by user",
        },
      });
    });

    const cust = await db.customer.findUnique({
      where: { id: oldTx.customerId },
      select: { locationId: true },
    });

    if (cust) {
      revalidatePath(`/billing/${cust.locationId}/customers/${oldTx.customerId}`);
      revalidatePath(`/billing/${cust.locationId}`);
    }
    revalidatePath("/billing");
    revalidatePath("/");
    revalidatePath("/reports");
    revalidatePath("/audit-logs");

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete transaction" };
  }
}
export const softDeleteTransactionAction = withPerformance("softDeleteTransactionAction", "action", softDeleteTransactionActionImpl);

async function restoreTransactionActionImpl(transactionId: string) {
  try {
    const session = await requireAuth();

    const tx = await db.transaction.findFirst({
      where: { id: transactionId, shopId: session.shopId, isDeleted: true },
      select: { id: true, customerId: true },
    });
    if (!tx) return { success: false, error: "Transaction not found or not deleted" };

    const customer = await db.customer.findFirst({
      where: { id: tx.customerId, shopId: session.shopId },
      select: { id: true, isDeleted: true, locationId: true },
    });
    if (!customer) return { success: false, error: "Parent customer not found" };

    const location = await db.location.findFirst({
      where: { id: customer.locationId, shopId: session.shopId },
      select: { id: true, isDeleted: true },
    });
    if (!location) return { success: false, error: "Parent location not found" };

    const needsLocationRestore = location.isDeleted;
    const needsCustomerRestore = customer.isDeleted;

    await db.$transaction(async (prisma) => {
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
            changeReason: "Location restored as ancestor of restored transaction",
          },
        });
      }

      if (needsCustomerRestore) {
        await prisma.customer.update({
          where: { id: tx.customerId },
          data: { isDeleted: false, deletedAt: null },
        });

        await prisma.auditLog.create({
          data: {
            shopId: session.shopId,
            userId: session.userId,
            action: AuditAction.RESTORE,
            entityType: "CUSTOMER",
            entityId: tx.customerId,
            previousValue: { isDeleted: true },
            newValue: { isDeleted: false },
            changeReason: "Customer restored as parent of restored transaction",
          },
        });
      }

      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          isDeleted: false,
          deletedAt: null,
          deletedById: null,
        },
      });

      await prisma.auditLog.create({
        data: {
          shopId: session.shopId,
          userId: session.userId,
          action: AuditAction.RESTORE,
          entityType: "TRANSACTION",
          entityId: transactionId,
          transactionId,
          previousValue: { isDeleted: true },
          newValue: { isDeleted: false },
          changeReason: [
            needsLocationRestore ? "location restored" : null,
            needsCustomerRestore ? "customer restored" : null,
            "transaction restored",
          ]
            .filter(Boolean)
            .join("; "),
        },
      });
    });

    if (customer) {
      revalidatePath(`/billing/${customer.locationId}/customers/${tx.customerId}`);
      revalidatePath(`/billing/${customer.locationId}`);
    }
    revalidatePath("/billing");
    revalidatePath("/");
    revalidatePath("/reports");
    revalidatePath("/audit-logs");
    revalidatePath("/recycle-bin");

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to restore transaction" };
  }
}
export const restoreTransactionAction = withPerformance("restoreTransactionAction", "action", restoreTransactionActionImpl);

async function getAllTransactionsActionImpl() {
  try {
    const session = await requireAuth();

    const transactions = await db.transaction.findMany({
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
    });

    return {
      success: true,
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        paymentMethod: t.paymentMethod,
        transactionDate: t.transactionDate,
        customerName: t.customer?.name || "Customer",
        customerId: t.customerId,
        createdByName: t.createdBy?.name || "User",
        billImageKey: t.billImageKey,
      })),
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch transactions" };
  }
}
export const getAllTransactionsAction = withPerformance("getAllTransactionsAction", "action", getAllTransactionsActionImpl);
