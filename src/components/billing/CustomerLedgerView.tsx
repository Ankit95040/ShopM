"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Plus,
  ArrowDownLeft,
  Share2,
  Printer,
  Phone,
  MapPin,
  Trash2,
  FileText,
  X,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  addDebtAction,
  addPaymentAction,
  softDeleteTransactionAction,
  restoreTransactionAction,
} from "@/server/actions/transaction.actions";
import { uploadBillImage, getBillImageSignedUrl } from "@/server/actions/upload.actions";
import { PaymentMethod } from "@prisma/client";
import { useTranslation } from "@/lib/i18n";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { useToast } from "@/components/shared/ToastContext";
import { ImageViewer } from "@/components/shared/ImageViewer";

export interface TransactionItem {
  id: string;
  type: "DEBT" | "PAYMENT_RECEIVED";
  amount: number;
  billNumber?: string | null;
  paymentMethod?: string | null;
  description?: string | null;
  billImageUrl?: string | null;
  billImageKey?: string | null;
  transactionDate: string | Date;
  createdByName: string;
  updatedByName?: string | null;
  updatedAt?: string | Date | null;
  runningBalance?: number;
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
}: {
  initialData: CustomerAccountData;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [data, setData] = useState(initialData);

  // Modals
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Add Debt Form State
  const [debtAmount, setDebtAmount] = useState("");
  const [debtBillNo, setDebtBillNo] = useState("");
  const [debtDesc, setDebtDesc] = useState("");
  const [debtImageUrl, setDebtImageUrl] = useState("");
  const [debtDate, setDebtDate] = useState(new Date().toISOString().slice(0, 16));

  // Bill Image Upload State
  const [debtImageFile, setDebtImageFile] = useState<File | null>(null);
  const [debtImagePreview, setDebtImagePreview] = useState<string | null>(null);
  const debtFileInputRef = useRef<HTMLInputElement>(null);

  // Add Payment Form State
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paymentDesc, setPaymentDesc] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 16));

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteTxTarget, setDeleteTxTarget] = useState<TransactionItem | null>(null);
  const [isDeletingTx, setIsDeletingTx] = useState(false);

  // Period selector
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");

  const { customer, summary, debtTransactions, paymentTransactions } = data;
  const isAdvance = summary.outstandingBalance < 0;

  // Compute running balance for all transactions (sorted by date ascending)
  const sortedAllTxs = [...data.allTransactions].sort((a, b) => {
    const dateA = new Date(a.transactionDate).getTime();
    const dateB = new Date(b.transactionDate).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return a.id.localeCompare(b.id);
  });

  // Build available months from transactions
  const availableMonths = (() => {
    const months = new Map<string, string>();
    for (const tx of data.allTransactions) {
      const d = new Date(tx.transactionDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      if (!months.has(key)) months.set(key, label);
    }
    return Array.from(months.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  })();

  // Filter transactions by selected period
  const filteredAllTxs = (() => {
    if (selectedPeriod === "all") return sortedAllTxs;
    const [year, month] = selectedPeriod.split("-").map(Number);
    return sortedAllTxs.filter((tx) => {
      const d = new Date(tx.transactionDate);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  })();

  // Compute running balance for filtered transactions
  const filteredWithBalance = useMemo(() => {
    let openingBalance = 0;
    if (selectedPeriod !== "all") {
      const [year, month] = selectedPeriod.split("-").map(Number);
      for (const tx of sortedAllTxs) {
        const d = new Date(tx.transactionDate);
        if (d.getFullYear() < year || (d.getFullYear() === year && d.getMonth() + 1 < month)) {
          if (tx.type === "DEBT") openingBalance += tx.amount;
          else openingBalance -= tx.amount;
        }
      }
    }
    const { result } = filteredAllTxs.reduce(
      (acc, tx) => {
        const next = tx.type === "DEBT" ? acc.cumulative + tx.amount : acc.cumulative - tx.amount;
        acc.result.push({ ...tx, runningBalance: next });
        return { ...acc, cumulative: next };
      },
      { cumulative: openingBalance, result: [] as Array<TransactionItem & { runningBalance: number }> }
    );
    return result;
  }, [filteredAllTxs, selectedPeriod, sortedAllTxs]);

  // For display: show latest transactions first
  const displayTxs = [...filteredWithBalance].reverse();

  // Handle file selection for bill image
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Only JPEG, PNG, and WebP images are allowed.");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 5MB.");
      return;
    }

    setDebtImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setDebtImagePreview(previewUrl);
  };

  // Remove selected bill image
  const handleRemoveImage = () => {
    setDebtImageFile(null);
    if (debtImagePreview) {
      URL.revokeObjectURL(debtImagePreview);
      setDebtImagePreview(null);
    }
    if (debtFileInputRef.current) {
      debtFileInputRef.current.value = "";
    }
  };

  // Handle viewing bill image from transaction
  const handleViewBillImage = async (tx: TransactionItem) => {
    // If we have a billImageKey, get a signed URL
    if (tx.billImageKey) {
      const res = await getBillImageSignedUrl({
        transactionId: tx.id,
        customerId: customer.id,
      });
      if (res.success && res.url) {
        setSelectedImage(res.url);
      } else {
        toast.error(res.error || "Failed to load bill image");
      }
    } else if (tx.billImageUrl) {
      // Legacy: use billImageUrl directly
      setSelectedImage(tx.billImageUrl);
    }
  };

  // Handle Add Debt
  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(debtAmount);
    if (isNaN(amt) || amt <= 0) return;

    setIsSubmitting(true);

    const res = await addDebtAction({
      customerId: customer.id,
      amount: amt,
      billNumber: debtBillNo || undefined,
      description: debtDesc || undefined,
      transactionDate: new Date(debtDate),
    });

    if (res.success && res.transaction) {
      // Upload bill image if selected
      let uploadedBillImageKey: string | null = null;
      if (debtImageFile && res.transaction.id) {
        const formData = new FormData();
        formData.append("transactionId", res.transaction.id);
        formData.append("customerId", customer.id);
        formData.append("file", debtImageFile);

        const uploadRes = await uploadBillImage(formData);

        if (uploadRes.success && uploadRes.billImageKey) {
          uploadedBillImageKey = uploadRes.billImageKey;
        } else {
          // Image upload failed, but transaction was created - show warning
          toast.error(uploadRes.error || "Failed to upload bill image. Transaction was saved without image.");
        }
      }

      const newTx: TransactionItem = {
        id: res.transaction.id,
        type: "DEBT",
        amount: amt,
        billNumber: debtBillNo || null,
        description: debtDesc || null,
        billImageUrl: debtImageUrl || null,
        billImageKey: uploadedBillImageKey,
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
      handleRemoveImage();
      toast.success("Bill added successfully");
    } else {
      toast.error(res.error || "Failed to add debt");
    }

    setIsSubmitting(false);
  };

  // Handle Add Payment
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) return;

    setIsSubmitting(true);

    const res = await addPaymentAction({
      customerId: customer.id,
      amount: amt,
      paymentMethod,
      description: paymentDesc || undefined,
      transactionDate: new Date(paymentDate),
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
      toast.success("Payment added successfully");
    } else {
      toast.error(res.error || "Failed to add payment");
    }
  };

  // Handle Delete Transaction
  const handleDeleteTransaction = async () => {
    if (!deleteTxTarget) return;
    setIsDeletingTx(true);
    const res = await softDeleteTransactionAction({
      transactionId: deleteTxTarget.id,
      reason: "Deleted by user",
    });
    setIsDeletingTx(false);

    if (res.success) {
      setData((prev) => {
        const isDebt = deleteTxTarget.type === "DEBT";
        const amt = deleteTxTarget.amount;
        return {
          ...prev,
          summary: {
            ...prev.summary,
            totalDebt: isDebt ? prev.summary.totalDebt - amt : prev.summary.totalDebt,
            totalReceived: !isDebt ? prev.summary.totalReceived - amt : prev.summary.totalReceived,
            outstandingBalance: isDebt
              ? prev.summary.outstandingBalance - amt
              : prev.summary.outstandingBalance + amt,
            transactionCount: prev.summary.transactionCount - 1,
          },
          debtTransactions: prev.debtTransactions.filter((t) => t.id !== deleteTxTarget.id),
          paymentTransactions: prev.paymentTransactions.filter((t) => t.id !== deleteTxTarget.id),
          allTransactions: prev.allTransactions.filter((t) => t.id !== deleteTxTarget.id),
        };
      });
      const deletedId = deleteTxTarget.id;
      toast.undo("Transaction deleted successfully", async () => {
        const restoreRes = await restoreTransactionAction(deletedId);
        if (restoreRes.success) {
          window.location.reload();
        }
      });
    } else {
      toast.error("Failed to delete transaction");
    }
    setDeleteTxTarget(null);
  };

  // WhatsApp Statement Generator (Period-Based)
  const generateWhatsAppMessage = () => {
    const periodLabel = selectedPeriod === "all"
      ? t("allTime")
      : availableMonths.find(([k]) => k === selectedPeriod)?.[1] || selectedPeriod;

    // Calculate period metrics from filtered transactions
    let periodBills = 0;
    let periodPayments = 0;
    for (const tx of filteredWithBalance) {
      if (tx.type === "DEBT") periodBills += tx.amount;
      else periodPayments += tx.amount;
    }

    // Calculate opening balance for the period
    let openingBalance = 0;
    if (selectedPeriod !== "all") {
      const [year, month] = selectedPeriod.split("-").map(Number);
      for (const tx of sortedAllTxs) {
        const d = new Date(tx.transactionDate);
        if (d.getFullYear() < year || (d.getFullYear() === year && d.getMonth() + 1 < month)) {
          if (tx.type === "DEBT") openingBalance += tx.amount;
          else openingBalance -= tx.amount;
        }
      }
    }

    const currentBalance = openingBalance + periodBills - periodPayments;
    const isBalanceAdvance = currentBalance < 0;

    const header = t("waStatementHeader", { location: customer.locationName });
    const custLine = `*${t("waCustomer")}:* ${customer.name}`;
    const phoneLine = `*${t("waPhone")}:* ${customer.phone}`;
    const dateLine = `*${t("waDate")}:* ${formatDate(new Date(), "dd MMM yyyy")}`;
    const periodLine = `*${t("waPeriod")}:* ${periodLabel}`;
    const khataSummary = t("waKhataSummary");

    const openingLine = t("waOpeningBalance", { amount: formatCurrency(openingBalance) });
    const billsLine = t("waPeriodBills", { amount: formatCurrency(periodBills) });
    const paymentsLine = t("waPeriodPayments", { amount: formatCurrency(periodPayments) });
    const balanceLine = isBalanceAdvance
      ? t("waAdvanceBalance", { amount: formatCurrency(Math.abs(currentBalance)) })
      : t("waOutstandingDue", { amount: formatCurrency(currentBalance) });

    // Show last 5 transactions from filtered period
    const recentTxs = filteredWithBalance.slice(-5);
    const recentTxTitle = t("waRecentTransactions");
    const txLines = recentTxs
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

    const thankYou = t("waThankYou");

    const text = `${header}\n${custLine}\n${phoneLine}\n${dateLine}\n${periodLine}\n\n${khataSummary}\n${openingLine}\n${billsLine}\n${paymentsLine}\n${balanceLine}\n\n${recentTxTitle}\n${txLines}\n\n${thankYou}`;

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

      {/* PERIOD SELECTOR */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-slate-600">{t("viewPeriod")}:</span>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setSelectedPeriod("all")}
            className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              selectedPeriod === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t("allTime")}
          </button>
          {availableMonths.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedPeriod(key)}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                selectedPeriod === key
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
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
              onClick={() => setIsAddDebtOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-red-700 transition active:scale-98"
            >
              <Plus className="h-4 w-4" />
              <span>{t("addDebtBillBtn")}</span>
            </button>

            <button
              onClick={() => setIsAddPaymentOpen(true)}
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
            {displayTxs.filter((tx) => tx.type === "DEBT").length > 0 ? (
              displayTxs.filter((tx) => tx.type === "DEBT").map((txItem) => (
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

                    {txItem.billImageKey && (
                      <button
                        onClick={() => handleViewBillImage(txItem)}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition mt-1"
                        title={t("viewAttachedBillPhoto")}
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    )}
                    {!txItem.billImageKey && txItem.billImageUrl && (
                      <button
                        onClick={() => handleViewBillImage(txItem)}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition mt-1"
                        title={t("viewAttachedBillPhoto")}
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="text-right">
                      <div className="text-base font-black text-red-600">
                        {formatCurrency(txItem.amount)}
                      </div>
                      {txItem.runningBalance !== undefined && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {t("balance")}: {formatCurrency(txItem.runningBalance)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setDeleteTxTarget(txItem)}
                      className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600 transition shrink-0"
                      title="Delete Bill"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
            {displayTxs.filter((tx) => tx.type === "PAYMENT_RECEIVED").length > 0 ? (
              displayTxs.filter((tx) => tx.type === "PAYMENT_RECEIVED").map((txItem) => (
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

                  <div className="flex items-start gap-3">
                    <div className="text-right">
                      <div className="text-base font-black text-emerald-600">
                        {formatCurrency(txItem.amount)}
                      </div>
                      {txItem.runningBalance !== undefined && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {t("balance")}: {formatCurrency(txItem.runningBalance)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setDeleteTxTarget(txItem)}
                      className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600 transition shrink-0"
                      title="Delete Payment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
                  type="file"
                  ref={debtFileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
                {/* Image Preview */}
                {debtImagePreview && (
                  <div className="mt-2 relative inline-block">
                    <Image
                      src={debtImagePreview}
                      alt="Bill preview"
                      width={200}
                      height={150}
                      className="rounded-xl border border-slate-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  {t("billImageHint")}
                </p>
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

      {/* BILL IMAGE VIEWER */}
      <ImageViewer
        src={selectedImage || ""}
        alt="Bill Image"
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
      />

      {/* DELETE TRANSACTION CONFIRM MODAL */}
      <ConfirmModal
        isOpen={!!deleteTxTarget}
        title={deleteTxTarget?.type === "DEBT" ? "Delete Bill?" : "Delete Payment?"}
        description={
          deleteTxTarget
            ? `Are you sure you want to delete this ${deleteTxTarget.type === "DEBT" ? "bill" : "payment"} of ${formatCurrency(deleteTxTarget.amount)}? This action will undo the balance change.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteTransaction}
        onCancel={() => setDeleteTxTarget(null)}
        isLoading={isDeletingTx}
      />
    </div>
  );
}
