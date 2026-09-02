"use server";

import { db } from "@/server/db";
import { requireAuth } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { AuditAction, Prisma } from "@prisma/client";

export async function createCustomerAction({
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

export async function getCustomersByLocationAction(locationId: string, search?: string) {
  try {
    const session = await requireAuth();
    const whereClause: Prisma.CustomerWhereInput = {
      shopId: session.shopId,
      locationId,
      isDeleted: false,
    };

    if (search?.trim()) {
      whereClause.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { phone: { contains: search.trim() } },
      ];
    }

    const customers = await db.customer.findMany({
      where: whereClause,
      include: {
        transactions: {
          where: { isDeleted: false },
          select: { type: true, amount: true, transactionDate: true },
          orderBy: { transactionDate: "desc" },
        },
        createdBy: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    const formatted = customers.map((c) => {
      let totalDebt = 0;
      let totalReceived = 0;

      for (const t of c.transactions) {
        const amt = Number(t.amount);
        if (t.type === "DEBT") totalDebt += amt;
        else if (t.type === "PAYMENT_RECEIVED") totalReceived += amt;
      }

      const balance = totalDebt - totalReceived;

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        createdByName: c.createdBy.name,
        totalDebt,
        totalReceived,
        outstandingBalance: balance,
        transactionCount: c.transactions.length,
        lastTransactionDate: c.transactions[0]?.transactionDate || null,
      };
    });

    return { success: true, customers: formatted };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch customers" };
  }
}

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

export async function getCustomerAccountDetailsAction(customerId: string) {
  try {
    const session = await requireAuth();
    const customer = await db.customer.findUnique({
      where: { id: customerId, shopId: session.shopId, isDeleted: false },
      include: {
        location: true,
        createdBy: { select: { name: true } },
        transactions: {
          where: { isDeleted: false },
          include: {
            createdBy: { select: { name: true } },
            updatedBy: { select: { name: true } },
          },
          orderBy: { transactionDate: "asc" },
        },
      },
    });

    if (!customer) return { success: false, error: "Customer not found" };

    let totalDebt = 0;
    let totalReceived = 0;

    const debtTransactions: SerializedTransaction[] = [];
    const paymentTransactions: SerializedTransaction[] = [];
    const allTransactions: SerializedTransaction[] = [];

    for (const t of customer.transactions) {
      const amt = Number(t.amount);
      const item = {
        id: t.id,
        type: t.type,
        amount: amt,
        billNumber: t.billNumber,
        paymentMethod: t.paymentMethod,
        description: t.description,
        billImageUrl: t.billImageUrl,
        transactionDate: t.transactionDate,
        createdByName: t.createdBy.name,
        updatedByName: t.updatedBy?.name,
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
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          createdAt: customer.createdAt,
          locationId: customer.locationId,
          locationName: customer.location.name,
          createdByName: customer.createdBy.name,
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

export async function softDeleteCustomerAction(customerId: string) {
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

export async function restoreCustomerAction(customerId: string) {
  try {
    const session = await requireAuth();

    const customer = await db.customer.findFirst({
      where: { id: customerId, shopId: session.shopId, isDeleted: true },
      select: { id: true, name: true, locationId: true },
    });
    if (!customer) return { success: false, error: "Customer not found or not deleted" };

    const tx = await db.$transaction(async (prisma) => {
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
          changeReason: "Customer restored by user",
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

export async function getDeletedCustomersAction() {
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
