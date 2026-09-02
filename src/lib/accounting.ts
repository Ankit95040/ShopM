import { formatCurrency } from "@/lib/formatters";

export interface TransactionRecord {
  type: "DEBT" | "PAYMENT_RECEIVED";
  amount: number;
  transactionDate: Date | string;
}

export interface PeriodReport {
  openingBalance: number;
  billsInPeriod: number;
  paymentsInPeriod: number;
  closingBalance: number;
  billCount: number;
  paymentCount: number;
  totalDebt: number;
  totalPayments: number;
}

/**
 * Calculate period-based accounting report from a list of transactions.
 * 
 * Logic:
 * - Opening Balance = outstanding immediately BEFORE the first day of the selected period
 * - Bills in Period = sum of DEBT transactions within the period
 * - Payments in Period = sum of PAYMENT_RECEIVED transactions within the period
 * - Closing Balance = Opening Balance + Bills - Payments
 * 
 * If no period is specified (all time), opening is 0 and all transactions are counted.
 */
export function calculatePeriodReport(
  transactions: TransactionRecord[],
  periodStart?: Date | null,
  periodEnd?: Date | null
): PeriodReport {
  // Sort all transactions chronologically (ascending)
  const sorted = [...transactions].sort((a, b) => {
    const dateA = new Date(a.transactionDate).getTime();
    const dateB = new Date(b.transactionDate).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return 0;
  });

  let openingBalance = 0;
  let billsInPeriod = 0;
  let paymentsInPeriod = 0;
  let billCount = 0;
  let paymentCount = 0;
  let totalDebt = 0;
  let totalPayments = 0;

  const startMs = periodStart ? new Date(periodStart).getTime() : 0;
  const endMs = periodEnd ? new Date(periodEnd).getTime() : Infinity;

  for (const tx of sorted) {
    const txDate = new Date(tx.transactionDate).getTime();
    const amt = Number(tx.amount);

    // Count total across all time
    if (tx.type === "DEBT") totalDebt += amt;
    else totalPayments += amt;

    // Opening balance: transactions BEFORE period start
    if (periodStart && txDate < startMs) {
      if (tx.type === "DEBT") openingBalance += amt;
      else openingBalance -= amt;
      continue;
    }

    // Within period (up to periodEnd)
    if (txDate <= endMs) {
      if (tx.type === "DEBT") {
        billsInPeriod += amt;
        billCount++;
      } else {
        paymentsInPeriod += amt;
        paymentCount++;
      }
    }
  }

  const closingBalance = openingBalance + billsInPeriod - paymentsInPeriod;

  return {
    openingBalance,
    billsInPeriod,
    paymentsInPeriod,
    closingBalance,
    billCount,
    paymentCount,
    totalDebt,
    totalPayments,
  };
}

/**
 * Get period start/end dates for a given month key (e.g., "2026-09").
 * Returns null for "all" period.
 */
export function getPeriodDates(
  monthKey: string
): { start: Date; end: Date } | null {
  if (!monthKey || monthKey === "all") return null;
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Generate WhatsApp statement text with professional formatting.
 */
export function generateWhatsAppStatement(params: {
  customerName: string;
  customerPhone: string;
  locationName: string;
  periodLabel: string;
  openingBalance: number;
  billsInPeriod: number;
  paymentsInPeriod: number;
  closingBalance: number;
  recentTransactions: Array<{
    type: "DEBT" | "PAYMENT_RECEIVED";
    amount: number;
    date: Date | string;
    detail?: string;
  }>;
  isAdvance?: boolean;
}): string {
  const {
    customerName,
    customerPhone,
    locationName,
    periodLabel,
    openingBalance,
    billsInPeriod,
    paymentsInPeriod,
    closingBalance,
    recentTransactions,
    isAdvance = closingBalance < 0,
  } = params;

  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const lines: string[] = [
    `\u{1F4D2} *Account Statement*`,
    `\u{1F3E2} ${locationName}`,
    ``,
    `*Customer:* ${customerName}`,
    `*Phone:* ${customerPhone}`,
    `*Date:* ${dateStr}`,
    `*Period:* ${periodLabel}`,
    ``,
    `\u{1F4CA} *Khata Summary*`,
    `\u{2022} Opening Balance: ${formatCurrency(openingBalance)}`,
    `\u{2022} Bills This Period: ${formatCurrency(billsInPeriod)}`,
    `\u{2022} Payments This Period: ${formatCurrency(paymentsInPeriod)}`,
  ];

  if (isAdvance) {
    lines.push(
      `\u{2022} *Advance Balance: ${formatCurrency(Math.abs(closingBalance))}*`
    );
  } else {
    lines.push(
      `\u{2022} *Outstanding Due: ${formatCurrency(closingBalance)}*`
    );
  }

  if (recentTransactions.length > 0) {
    lines.push(``, `*Recent Transactions:*`);
    for (const tx of recentTransactions) {
      const dateFormatted = new Date(tx.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      });
      if (tx.type === "DEBT") {
        lines.push(
          `\u{1F534} ${dateFormatted} - Debt: ${formatCurrency(tx.amount)}${tx.detail ? ` (${tx.detail})` : ""}`
        );
      } else {
        lines.push(
          `\u{1F7E2} ${dateFormatted} - Received: ${formatCurrency(tx.amount)}${tx.detail ? ` (${tx.detail})` : ""}`
        );
      }
    }
  }

  lines.push(``, `_Thank you for your business!_`);

  return lines.join("\n");
}
