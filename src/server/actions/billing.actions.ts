"use server";

import { db } from "@/server/db";
import { requireAuth } from "@/server/auth";

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

export async function getShopBillingSummary(): Promise<ShopBillingSummary> {
  const session = await requireAuth();

  const activeCustomerIds = await db.customer.findMany({
    where: { shopId: session.shopId, isDeleted: false },
    select: { id: true },
  });
  const ids = activeCustomerIds.map((c) => c.id);

  const [allTxs, customerCount] = await Promise.all([
    ids.length > 0
      ? db.transaction.findMany({
          where: {
            shopId: session.shopId,
            isDeleted: false,
            customerId: { in: ids },
          },
          select: { type: true, amount: true },
        })
      : Promise.resolve([]),
    db.customer.count({
      where: { shopId: session.shopId, isDeleted: false },
    }),
  ]);

  let totalDebt = 0;
  let totalReceived = 0;

  for (const t of allTxs) {
    const amt = Number(t.amount);
    if (t.type === "DEBT") totalDebt += amt;
    else if (t.type === "PAYMENT_RECEIVED") totalReceived += amt;
  }

  return {
    totalDebt,
    totalReceived,
    outstandingBalance: totalDebt - totalReceived,
    totalCustomerCount: customerCount,
  };
}

export async function getMonthlyBillingSummary(): Promise<MonthlyBillingSummary> {
  const session = await requireAuth();

  const activeCustomerIds = await db.customer.findMany({
    where: { shopId: session.shopId, isDeleted: false },
    select: { id: true },
  });
  const ids = activeCustomerIds.map((c) => c.id);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [monthTxs, customerCount] = await Promise.all([
    ids.length > 0
      ? db.transaction.findMany({
          where: {
            shopId: session.shopId,
            isDeleted: false,
            customerId: { in: ids },
          },
          select: { type: true, amount: true, transactionDate: true },
        })
      : Promise.resolve([]),
    db.customer.count({
      where: { shopId: session.shopId, isDeleted: false },
    }),
  ]);

  let totalDebtAll = 0;
  let totalReceivedAll = 0;
  let billsThisMonth = 0;
  let paymentsThisMonth = 0;

  for (const t of monthTxs) {
    const amt = Number(t.amount);
    const txDate = new Date(t.transactionDate);
    if (t.type === "DEBT") {
      totalDebtAll += amt;
      if (txDate >= monthStart) billsThisMonth += amt;
    } else if (t.type === "PAYMENT_RECEIVED") {
      totalReceivedAll += amt;
      if (txDate >= monthStart) paymentsThisMonth += amt;
    }
  }

  const currentOutstanding = totalDebtAll - totalReceivedAll;
  const openingOutstanding = currentOutstanding - billsThisMonth + paymentsThisMonth;

  return {
    openingOutstanding,
    billsThisMonth,
    paymentsThisMonth,
    currentOutstanding,
    totalCustomerCount: customerCount,
  };
}
