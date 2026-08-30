"use server";

import { db } from "@/server/db";
import { TransactionType, PaymentMethod, AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function addDebtAction({
  customerId,
  amount,
  billNumber,
  description,
  billImageUrl,
  billImagePublicId,
  transactionDate,
  createdById,
}: {
  customerId: string;
  amount: number;
  billNumber?: string;
  description?: string;
  billImageUrl?: string;
  billImagePublicId?: string;
  transactionDate?: Date | string;
  createdById: string;
}) {
  try {
    if (!amount || amount <= 0) {
      return { success: false, error: "Amount must be greater than zero" };
    }

    const tx = await db.transaction.create({
      data: {
        customerId,
        type: TransactionType.DEBT,
        amount,
        billNumber: billNumber?.trim() || null,
        description: description?.trim() || null,
        billImageUrl: billImageUrl || null,
        billImagePublicId: billImagePublicId || null,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        createdById,
      },
    });

    const cust = await db.customer.findUnique({
      where: { id: customerId },
      select: { locationId: true },
    });

    if (cust) {
      revalidatePath(`/billing/${cust.locationId}/customers/${customerId}`);
      revalidatePath(`/billing/${cust.locationId}`);
    }
    revalidatePath("/billing");
    revalidatePath("/");

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
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to add debt transaction" };
  }
}

export async function addPaymentAction({
  customerId,
  amount,
  paymentMethod,
  description,
  transactionDate,
  createdById,
}: {
  customerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  description?: string;
  transactionDate?: Date | string;
  createdById: string;
}) {
  try {
    if (!amount || amount <= 0) {
      return { success: false, error: "Amount must be greater than zero" };
    }

    const tx = await db.transaction.create({
      data: {
        customerId,
        type: TransactionType.PAYMENT_RECEIVED,
        amount,
        paymentMethod,
        description: description?.trim() || null,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        createdById,
      },
    });

    const cust = await db.customer.findUnique({
      where: { id: customerId },
      select: { locationId: true },
    });

    if (cust) {
      revalidatePath(`/billing/${cust.locationId}/customers/${customerId}`);
      revalidatePath(`/billing/${cust.locationId}`);
    }
    revalidatePath("/billing");
    revalidatePath("/");

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
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to add payment transaction" };
  }
}

export async function editTransactionAction({
  transactionId,
  amount,
  billNumber,
  paymentMethod,
  description,
  billImageUrl,
  changeReason,
  updatedById,
}: {
  transactionId: string;
  amount: number;
  billNumber?: string;
  paymentMethod?: PaymentMethod;
  description?: string;
  billImageUrl?: string;
  changeReason: string;
  updatedById: string;
}) {
  try {
    if (!changeReason?.trim()) {
      return { success: false, error: "Change reason is mandatory for financial audits" };
    }

    const oldTx = await db.transaction.findUniqueOrThrow({
      where: { id: transactionId },
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
          updatedById,
        },
      });

      // Write immutable audit log
      await prisma.auditLog.create({
        data: {
          userId: updatedById,
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
    }

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
        transactionDate: updatedTx.transactionDate,
        createdAt: updatedTx.createdAt,
        updatedAt: updatedTx.updatedAt,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to edit transaction" };
  }
}

export async function softDeleteTransactionAction({
  transactionId,
  reason,
  deletedById,
}: {
  transactionId: string;
  reason: string;
  deletedById: string;
}) {
  try {
    const oldTx = await db.transaction.findUniqueOrThrow({
      where: { id: transactionId },
    });

    await db.$transaction(async (prisma) => {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedById,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: deletedById,
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

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete transaction" };
  }
}
