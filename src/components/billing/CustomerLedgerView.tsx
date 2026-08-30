"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Share2,
  Printer,
  Phone,
  MapPin,
  Calendar,
  Image as ImageIcon,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  CreditCard,
  Building2,
  ExternalLink,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  addDebtAction,
  addPaymentAction,
  editTransactionAction,
  softDeleteTransactionAction,
} from "@/server/actions/transaction.actions";
import { PaymentMethod } from "@prisma/client";
import { useTranslation } from "@/lib/i18n";

export interface TransactionItem {
  id: string;
  type: "DEBT" | "PAYMENT_RECEIVED";
  amount: number;
  billNumber?: string | null;
  paymentMethod?: string | null;
  description?: string | null;
  billImageUrl?: string | null;
  transactionDate: string | Date;
  createdByName: string;
  updatedByName?: string | null;
  updatedAt?: string | Date | null;
}

export interface CustomerAccountData {
  customer: {
    id: string;
    name: string;
    phone: string;
    address?: string | null;
    createdAt: string | Date;
    locationId: string;
    locationName: string;
    createdByName: string;
  };
  summary: {
    totalDebt: number;
    totalReceived: number;
    outstandingBalance: number;
    transactionCount: number;
    lastTransactionDate?: string | Date | null;
  };
  debtTransactions: TransactionItem[];
  paymentTransactions: TransactionItem[];
  allTransactions: TransactionItem[];
}

export function CustomerLedgerView({
  initialData,
  userId,
}: {
  initialData: CustomerAccountData;
  userId: string;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState(initialData);

  // Modals
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Add Debt Form State
  const [debtAmount, setDebtAmount] = useState("");
  const [debtBillNo, setDebtBillNo] = useState("");
  const [debtDesc, setDebtDesc] = useState("");
  const [debtImageUrl, setDebtImageUrl] = useState("");
  const [debtDate, setDebtDate] = useState(new Date().toISOString().slice(0, 16));

  // Add Payment Form State
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paymentDesc, setPaymentDesc] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 16));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { customer, summary, debtTransactions, paymentTransactions } = data;
  const isAdvance = summary.outstandingBalance < 0;

  // Handle Add Debt
  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(debtAmount);
    if (isNaN(amt) || amt <= 0) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    const res = await addDebtAction({
      customerId: customer.id,
      amount: amt,
      billNumber: debtBillNo || undefined,
      description: debtDesc || undefined,
      billImageUrl: debtImageUrl || undefined,
      transactionDate: new Date(debtDate),
      createdById: userId,
    });

    setIsSubmitting(false);

    if (res.success && res.transaction) {
      const newTx: TransactionItem = {
        id: res.transaction.id,
        type: "DEBT",
        amount: amt,
        billNumber: debtBillNo || null,
        description: debtDesc || null,
        billImageUrl: debtImageUrl || null,
        transactionDate: new Date(debtDate),
        createdByName: "You",
      };

      setData((prev) => {
        const newTotalDebt = prev.summary.totalDebt + amt;
        const newBal = newTotalDebt - prev.summary.totalReceived;
        return {
          ...prev,
          summary: {
            ...prev.summary,
            totalDebt: newTotalDebt,
            outstandingBalance: newBal,
            transactionCount: prev.summary.transactionCount + 1,
            lastTransactionDate: new Date(debtDate),
          },
          debtTransactions: [...prev.debtTransactions, newTx],
          allTransactions: [...prev.allTransactions, newTx],
        };
      });

      setIsAddDebtOpen(false);
      setDebtAmount("");
      setDebtBillNo("");
      setDebtDesc("");
      setDebtImageUrl("");
    } else {
      setErrorMsg(res.error || "Failed to add debt");
    }
  };

  // Handle Add Payment
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    const res = await addPaymentAction({
      customerId: customer.id,
      amount: amt,
      paymentMethod,
      description: paymentDesc || undefined,
      transactionDate: new Date(paymentDate),
      createdById: userId,
    });

    setIsSubmitting(false);

    if (res.success && res.transaction) {
      const newTx: TransactionItem = {
        id: res.transaction.id,
        type: "PAYMENT_RECEIVED",
        amount: amt,
        paymentMethod,
        description: paymentDesc || null,
        transactionDate: new Date(paymentDate),
        createdByName: "You",
      };

      setData((prev) => {
        const newTotalRec = prev.summary.totalReceived + amt;
        const newBal = prev.summary.totalDebt - newTotalRec;
        return {
          ...prev,
          summary: {
            ...prev.summary,
            totalReceived: newTotalRec,
            outstandingBalance: newBal,
            transactionCount: prev.summary.transactionCount + 1,
            lastTransactionDate: new Date(paymentDate),
          },
          paymentTransactions: [...prev.paymentTransactions, newTx],
          allTransactions: [...prev.allTransactions, newTx],
        };
      });

      setIsAddPaymentOpen(false);
      setPaymentAmount("");
      setPaymentDesc("");
    } else {
      setErrorMsg(res.error || "Failed to add payment");
    }
  };

  // WhatsApp Statement Generator
  const generateWhatsAppMessage = () => {
    const balanceLine = isAdvance
      ? t("waAdvanceBalance", { amount: formatCurrency(Math.abs(summary.outstandingBalance)) })
      : t("waOutstandingDue", { amount: formatCurrency(summary.outstandingBalance) });

    const header = t("waStatementHeader", { location: customer.locationName });
    const custLine = `*${t("waCustomer")}:* ${customer.name}`;
    const phoneLine = `*${t("waPhone")}:* ${customer.phone}`;
    const dateLine = `*${t("waDate")}:* ${formatDate(new Date(), "dd MMM yyyy")}`;
    const khataSummary = t("waKhataSummary");
    const debtSum = t("waTotalDebt", { amount: formatCurrency(summary.totalDebt) });
    const recSum = t("waTotalReceived", { amount: formatCurrency(summary.totalReceived) });
    const recentTxTitle = t("waRecentTransactions");
    const thankYou = t("waThankYou");

    const txLines = data.allTransactions
      .slice(-5)
      .map((txItem) =>
        txItem.type === "DEBT"
          ? t("waDebtLine", {
              date: formatDate(txItem.transactionDate, "dd MMM"),
              amount: formatCurrency(txItem.amount),
              detail: txItem.billNumber || txItem.description || "Bill",
            })
          : t("waPaymentLine", {
              date: formatDate(txItem.transactionDate, "dd MMM"),
              amount: formatCurrency(txItem.amount),
              detail: txItem.paymentMethod || "Payment",
            })
      )
      .join("\n");

    const text = `${header}\n${custLine}\n${phoneLine}\n${dateLine}\n\n${khataSummary}\n${debtSum}\n${recSum}\n${balanceLine}\n\n${recentTxTitle}\n${txLines}\n\n${thankYou}`;

    return encodeURIComponent(text);
  };

  const handleShareWhatsApp = () => {
    const cleanPhone = customer.phone.replace(/[^0-9]/g, "");
    const url = `https://wa.me/${cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone}?text=${generateWhatsAppMessage()}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/billing/${customer.locationId}`}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
              <span>{customer.locationName}</span>
              <span>/</span>
              <span>{t("khataLedger")}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 sm:text-3xl flex items-center gap-2">
              {customer.name}
            </h1>
          </div>
        </div>

        {/* Action Buttons: WhatsApp & Print */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition"
          >
            <Share2 className="h-4 w-4" />
            <span>{t("shareWhatsAppStatement")}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <Printer className="h-4 w-4" />
            <span>{t("printStatement")}</span>
          </button>
        </div>
      </div>

      {/* CUSTOMER ACCOUNT SUMMARY CARD */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-6">
          {/* Customer Meta */}
          <div className="space-y-1">
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1 font-mono">
                <Phone className="h-3.5 w-3.5 text-slate-400" /> {customer.phone}
              </span>
              {customer.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" /> {customer.address}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {t("accountCreatedAt", {
                user: customer.createdByName,
                date: formatDate(customer.createdAt, "dd MMM yyyy"),
              })}
            </p>
          </div>

          {/* Quick Transaction Modals CTA */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setErrorMsg(null);
                setIsAddDebtOpen(true);
              }}
              className="flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-red-700 transition active:scale-98"
            >
              <Plus className="h-4 w-4" />
              <span>{t("addDebtBillBtn")}</span>
            </button>

            <button
              onClick={() => {
                setErrorMsg(null);
                setIsAddPaymentOpen(true);
              }}
              className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition active:scale-98"
            >
              <ArrowDownLeft className="h-4 w-4" />
              <span>{t("addPaymentBtn")}</span>
            </button>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 border-t border-slate-100 pt-5">
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <span className="text-xs font-bold text-slate-500">{t("totalDebtBills")}</span>
            <div className="mt-1 text-2xl font-black text-slate-900">
              {formatCurrency(summary.totalDebt)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {t("billsAddedCount", { count: debtTransactions.length })}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50/60 p-4 border border-emerald-100">
            <span className="text-xs font-bold text-emerald-800">{t("paymentsReceived")}</span>
            <div className="mt-1 text-2xl font-black text-emerald-700">
              {formatCurrency(summary.totalReceived)}
            </div>
            <p className="text-[11px] text-emerald-600 mt-0.5">
              {t("paymentsCollectedCount", { count: paymentTransactions.length })}
            </p>
          </div>

          <div className={`rounded-2xl p-4 border ${isAdvance ? "bg-emerald-50 border-emerald-200" : "bg-red-50/80 border-red-200"}`}>
            <span className={`text-xs font-bold ${isAdvance ? "text-emerald-800" : "text-red-800"}`}>
              {isAdvance ? t("advanceCreditBalance") : t("outstandingBalanceDue")}
            </span>
            <div className={`mt-1 text-2xl font-black ${isAdvance ? "text-emerald-800" : "text-red-700"}`}>
              {isAdvance ? formatCurrency(Math.abs(summary.outstandingBalance)) : formatCurrency(summary.outstandingBalance)}
            </div>
            <p className={`text-[11px] mt-0.5 ${isAdvance ? "text-emerald-600" : "text-red-500"}`}>
              {isAdvance ? t("excessAdvanceMsg") : t("balanceFormulaMsg")}
            </p>
          </div>
        </div>
      </div>

      {/* TWO SEPARATED VISUAL SECTIONS (LEFT: DEBT | RIGHT: PAYMENT RECEIVED) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT COLUMN: DEBT (BILLS & CREDIT PURCHASES) */}
        <div className="rounded-3xl border border-red-100 bg-white shadow-xs overflow-hidden">
          <div className="bg-red-50/80 px-6 py-4 border-b border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-600 text-white text-xs font-bold">
                D
              </span>
              <h3 className="text-base font-black text-red-950">{t("debtColumnTitle")}</h3>
            </div>
            <span className="text-xs font-bold text-red-700">
              {t("entriesCount", { count: debtTransactions.length })}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {debtTransactions.length > 0 ? (
              debtTransactions.map((txItem) => (
                <div key={txItem.id} className="p-4 sm:p-5 hover:bg-slate-50/60 transition flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {txItem.billNumber ? (
                        <span className="rounded-lg bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                          {txItem.billNumber}
                        </span>
                      ) : null}
                      <span className="text-xs font-semibold text-slate-800">
                        {txItem.description || "Purchase Bill"}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span>{formatDate(txItem.transactionDate, "dd MMM yyyy, hh:mm a")}</span>
                      <span>•</span>
                      <span>{t("addedBy")}: <strong className="text-slate-700">{txItem.createdByName}</strong></span>
                    </div>

                    {txItem.billImageUrl && (
                      <button
                        onClick={() => setSelectedImage(txItem.billImageUrl!)}
                        className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-700 hover:bg-sky-100 mt-1"
                      >
                        <ImageIcon className="h-3 w-3" />
                        <span>{t("viewAttachedBillPhoto")}</span>
                      </button>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-base font-black text-red-600">
                      {formatCurrency(txItem.amount)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                {t("noDebtRecords")}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: PAYMENT RECEIVED */}
        <div className="rounded-3xl border border-emerald-100 bg-white shadow-xs overflow-hidden">
          <div className="bg-emerald-50/80 px-6 py-4 border-b border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white text-xs font-bold">
                P
              </span>
              <h3 className="text-base font-black text-emerald-950">{t("paymentColumnTitle")}</h3>
            </div>
            <span className="text-xs font-bold text-emerald-700">
              {t("entriesCount", { count: paymentTransactions.length })}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {paymentTransactions.length > 0 ? (
              paymentTransactions.map((txItem) => (
                <div key={txItem.id} className="p-4 sm:p-5 hover:bg-slate-50/60 transition flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                        {txItem.paymentMethod || "CASH"}
                      </span>
                      {txItem.description && (
                        <span className="text-xs font-semibold text-slate-800">{txItem.description}</span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span>{formatDate(txItem.transactionDate, "dd MMM yyyy, hh:mm a")}</span>
                      <span>•</span>
                      <span>{t("addedBy")}: <strong className="text-slate-700">{txItem.createdByName}</strong></span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-black text-emerald-600">
                      {formatCurrency(txItem.amount)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                {t("noPaymentRecords")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADD DEBT MODAL */}
      {isAddDebtOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">{t("addDebtModalTitle", { name: customer.name })}</h3>

            {errorMsg && (
              <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{errorMsg}</div>
            )}

            <form onSubmit={handleAddDebt} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700">{t("debtAmountLabel")} *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 5000"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-black text-red-600 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t("debtBillNoLabel")}</label>
                <input
                  type="text"
                  placeholder={t("debtBillNoPlaceholder")}
                  value={debtBillNo}
                  onChange={(e) => setDebtBillNo(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none uppercase font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t("debtDescLabel")}</label>
                <input
                  type="text"
                  placeholder={t("debtDescPlaceholder")}
                  value={debtDesc}
                  onChange={(e) => setDebtDesc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t("debtImageLabel")}</label>
                <input
                  type="url"
                  placeholder={t("debtImagePlaceholder")}
                  value={debtImageUrl}
                  onChange={(e) => setDebtImageUrl(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t("dateAndTime")}</label>
                <input
                  type="datetime-local"
                  value={debtDate}
                  onChange={(e) => setDebtDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddDebtOpen(false)}
                  className="w-1/3 rounded-xl border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-red-700 disabled:opacity-50"
                >
                  {isSubmitting ? t("loading") : t("addDebtSubmitBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PAYMENT MODAL */}
      {isAddPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">{t("addPaymentModalTitle", { name: customer.name })}</h3>

            {errorMsg && (
              <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{errorMsg}</div>
            )}

            <form onSubmit={handleAddPayment} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700">{t("paymentAmountLabel")} *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 3000"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-black text-emerald-600 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t("paymentMethodLabel")} *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  <option value={PaymentMethod.CASH}>{t("paymentMethodCash")}</option>
                  <option value={PaymentMethod.UPI}>{t("paymentMethodUPI")}</option>
                  <option value={PaymentMethod.BANK_TRANSFER}>{t("paymentMethodBank")}</option>
                  <option value={PaymentMethod.OTHER}>{t("paymentMethodOther")}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t("paymentNotesLabel")}</label>
                <input
                  type="text"
                  placeholder={t("paymentNotesPlaceholder")}
                  value={paymentDesc}
                  onChange={(e) => setPaymentDesc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t("dateAndTime")}</label>
                <input
                  type="datetime-local"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddPaymentOpen(false)}
                  className="w-1/3 rounded-xl border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSubmitting ? t("loading") : t("addPaymentSubmitBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BILL IMAGE LIGHTBOX PREVIEW */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative max-w-2xl w-full bg-white rounded-3xl p-4 overflow-hidden">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h4 className="font-bold text-sm text-slate-900">{t("attachedBillImage")}</h4>
              <button
                onClick={() => setSelectedImage(null)}
                className="rounded-full bg-slate-100 p-1 text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 flex justify-center max-h-[70vh] overflow-auto">
              <img src={selectedImage} alt="Bill Receipt" className="max-w-full rounded-2xl object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
