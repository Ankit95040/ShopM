import { format } from "date-fns";

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = "INR"
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(num)) return "₹0.00";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatNumber(
  qty: number | string | null | undefined,
  decimals: number = 2
): string {
  const num = typeof qty === "string" ? parseFloat(qty) : (qty ?? 0);
  if (isNaN(num)) return "0";

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(num);
}

export function formatDate(
  date: Date | string | null | undefined,
  pattern: string = "dd MMM yyyy, hh:mm a"
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    return format(d, pattern);
  } catch {
    return "-";
  }
}

export function generateInvoiceNumber(
  storeCode: string,
  sequenceNumber: number,
  financialYear?: string
): string {
  const yearStr =
    financialYear ||
    (() => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const nextYearShort = (currentYear + 1).toString().slice(-2);
      return `${currentYear}-${nextYearShort}`;
    })();

  const paddedSeq = sequenceNumber.toString().padStart(5, "0");
  return `INV/${storeCode}/${yearStr}/${paddedSeq}`;
}

export function calculateItemTaxAndTotal({
  unitPrice,
  quantity,
  discountPercent = 0,
  taxRate = 0,
  isTaxInclusive = false,
}: {
  unitPrice: number;
  quantity: number;
  discountPercent?: number;
  taxRate?: number;
  isTaxInclusive?: boolean;
}) {
  const grossAmount = unitPrice * quantity;
  const discountAmount = (grossAmount * discountPercent) / 100;
  const netAmount = grossAmount - discountAmount;

  let taxAmount = 0;
  let totalAmount = 0;
  let taxableAmount = 0;

  if (isTaxInclusive) {
    totalAmount = netAmount;
    taxableAmount = (netAmount * 100) / (100 + taxRate);
    taxAmount = totalAmount - taxableAmount;
  } else {
    taxableAmount = netAmount;
    taxAmount = (taxableAmount * taxRate) / 100;
    totalAmount = taxableAmount + taxAmount;
  }

  return {
    grossAmount: Number(grossAmount.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    taxableAmount: Number(taxableAmount.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
  };
}
