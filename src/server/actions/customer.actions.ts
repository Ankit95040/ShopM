"use server";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";

export async function createCustomerAction({
  locationId,
  name,
  phone,
  address,
  createdById,
}: {
  locationId: string;
  name: string;
  phone: string;
  address?: string;
  createdById: string;
}) {
  try {
    if (!name.trim() || !phone.trim()) {
      return { success: false, error: "Name and phone are required" };
    }

    const customer = await db.customer.create({
      data: {
        locationId,
        name: name.trim(),
        phone: phone.trim(),
        address: address?.trim() || null,
        createdById,
      },
    });

    revalidatePath(`/billing/${locationId}`);
    revalidatePath("/billing");
    return { success: true, customer };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create customer" };
  }
}

export async function getCustomersByLocationAction(locationId: string, search?: string) {
  try {
    const whereClause: any = {
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
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch customers" };
  }
}

export async function getCustomerAccountDetailsAction(customerId: string) {
  try {
    const customer = await db.customer.findUnique({
      where: { id: customerId, isDeleted: false },
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

    const debtTransactions: any[] = [];
    const paymentTransactions: any[] = [];
    const allTransactions: any[] = [];

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
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch customer account" };
  }
}
