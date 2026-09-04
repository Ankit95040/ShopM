"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
  Pencil,
  X,
  ArrowRight,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  addDebtAction,
  addPaymentAction,
  editTransactionAction,
  softDeleteTransactionAction,
  restoreTransactionAction,
} from "@/server/actions/transaction.actions";
import { uploadBillImage, getBillImageSignedUrl, removeBillImage } from "@/server/actions/upload.actions";
import { PaymentMethod } from "@prisma/client";
import { useTranslation } from "@/lib/i18n";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { useToast } from "@/components/shared/ToastContext";
import { ImageViewer } from "@/components/shared/ImageViewer";

// Returns current time in Asia/Kolkata as YYYY-MM-DDTHH:mm for datetime-local (not UTC)
function getCurrentKolkataDateTimeLocal(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// Parses YYYY-MM-DDTHH:mm as Asia/Kolkata wall time to correct absolute Date (UTC)
function kolkataDateTimeLocalToDate(dateTimeLocal: string): Date {
  const [datePart, timePart] = dateTimeLocal.split("T");
  if (!datePart || !timePart) return new Date(dateTimeLocal);
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  if ([y, m, d, h, min].some((n) => Number.isNaN(n))) return new Date(dateTimeLocal);
  return new Date(Date.UTC(y, m - 1, d, h, min) - 5.5 * 60 * 60 * 1000);
}

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
  const router = useRouter();
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
  const [debtDate, setDebtDate] = useState(getCurrentKolkataDateTimeLocal());

  // Bill Image Upload State
  const [debtImageFile, setDebtImageFile] = useState<File | null>(null);
  const [debtImagePreview, setDebtImagePreview] = useState<string | null>(null);
  const debtFileInputRef = useRef<HTMLInputElement>(null);
  const debtCameraInputRef = useRef<HTMLInputElement>(null);

  // Edit Transaction State
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editBillNo, setEditBillNo] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [editChangeReason, setEditChangeReason] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editRemoveImage, setEditRemoveImage] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const editCameraInputRef = useRef<HTMLInputElement>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Add Payment Form State
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paymentDesc, setPaymentDesc] = useState("");
  const [paymentDate, setPaymentDate] = useState(getCurrentKolkataDateTimeLocal());

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default Date & Time to current India time when form opens (fixes UTC 5h30m behind)
  useEffect(() => {
    if (isAddDebtOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDebtDate(getCurrentKolkataDateTimeLocal());
    }
  }, [isAddDebtOpen]);
  useEffect(() => {
    if (isAddPaymentOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPaymentDate(getCurrentKolkataDateTimeLocal());
    }
  }, [isAddPaymentOpen]);

  const [deleteTxTarget, setDeleteTxTarget] = useState<TransactionItem | null>(null);
  const [isDeletingTx, setIsDeletingTx] = useState(false);

  // Mobile unified transaction filter
  const [mobileTxFilter, setMobileTxFilter] = useState<"ALL" | "DEBT" | "PAYMENT_RECEIVED">("ALL");
  const [mobileTxVisible, setMobileTxVisible] = useState(10);

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

    // Validate file size (5MB max) — must match server MAX_FILE_SIZE
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image is too large. Please select an image smaller than 5 MB.");
      // Clear the file input so user can re-select
      if (debtFileInputRef.current) debtFileInputRef.current.value = "";
      if (debtCameraInputRef.current) debtCameraInputRef.current.value = "";
      return;
    }

    setDebtImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setDebtImagePreview(previewUrl);
    // Default transaction date/time to NOW when bill image is selected (Asia/Kolkata)
    // Preserve manual override: user can still edit the datetime-local input afterwards
    setDebtDate(getCurrentKolkataDateTimeLocal());
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
    if (debtCameraInputRef.current) {
      debtCameraInputRef.current.value = "";
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

  // Handle edit file selection
  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Only JPEG, PNG, and WebP images are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image is too large. Please select an image smaller than 5 MB.");
      if (editFileInputRef.current) editFileInputRef.current.value = "";
      if (editCameraInputRef.current) editCameraInputRef.current.value = "";
      return;
    }
    setEditImageFile(file);
    setEditRemoveImage(false);
    if (editImagePreview) URL.revokeObjectURL(editImagePreview);
    const previewUrl = URL.createObjectURL(file);
    setEditImagePreview(previewUrl);
  };

  const handleRemoveEditImage = () => {
    setEditImageFile(null);
    if (editImagePreview) {
      URL.revokeObjectURL(editImagePreview);
      setEditImagePreview(null);
    }
    if (editFileInputRef.current) editFileInputRef.current.value = "";
    if (editCameraInputRef.current) editCameraInputRef.current.value = "";
  };

  const openEditModal = (tx: TransactionItem) => {
    setEditingTx(tx);
    setEditAmount(String(tx.amount));
    setEditBillNo(tx.billNumber || "");
    setEditDesc(tx.description || "");
    setEditPaymentMethod((tx.paymentMethod as PaymentMethod) || PaymentMethod.CASH);
    setEditChangeReason("");
    setEditImageFile(null);
    setEditRemoveImage(false);
    if (editImagePreview) {
      URL.revokeObjectURL(editImagePreview);
      setEditImagePreview(null);
    }
    if (editFileInputRef.current) editFileInputRef.current.value = "";
    if (editCameraInputRef.current) editCameraInputRef.current.value = "";
  };

  const closeEditModal = () => {
    setEditingTx(null);
    handleRemoveEditImage();
    setEditRemoveImage(false);
    setEditChangeReason("");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }
    if (!editChangeReason.trim()) {
      toast.error("Change reason is required for audit");
      return;
    }
    if (editImageFile && editImageFile.size > 5 * 1024 * 1024) {
      toast.error("Image is too large. Please select an image smaller than 5 MB.");
      return;
    }
    setIsEditSubmitting(true);
    try {
      const res = await editTransactionAction({
        transactionId: editingTx.id,
        amount: amt,
        billNumber: editingTx.type === "DEBT" ? editBillNo : undefined,
        paymentMethod: editingTx.type === "PAYMENT_RECEIVED" ? editPaymentMethod : undefined,
        description: editDesc || undefined,
        changeReason: editChangeReason.trim(),
      });
      if (!res.success || !res.transaction) {
        toast.error(res.error || "Failed to edit transaction");
        return;
      }
      let finalBillImageKey: string | null | undefined = editingTx.billImageKey;
      try {
        if (editRemoveImage && !editImageFile && editingTx.billImageKey) {
          const rm = await removeBillImage({ transactionId: editingTx.id, customerId: customer.id });
          if (!rm.success) {
            toast.error(rm.error || "Failed to remove bill image");
          } else {
            finalBillImageKey = null;
          }
        } else if (editImageFile) {
          const formData = new FormData();
          formData.append("transactionId", editingTx.id);
          formData.append("customerId", customer.id);
          formData.append("file", editImageFile);
          const up = await uploadBillImage(formData);
          if (!up.success) {
            toast.error(up.error || "Failed to upload bill image. Please try again.");
          } else {
            finalBillImageKey = up.billImageKey || null;
          }
        }
      } catch (err) {
        console.error("Image handling failed:", err);
        toast.error("Image upload failed. Please try again.");
      }
      const updated: TransactionItem = {
        ...editingTx,
        amount: amt,
        billNumber: editingTx.type === "DEBT" ? editBillNo || null : editingTx.billNumber,
        paymentMethod: editingTx.type === "PAYMENT_RECEIVED" ? editPaymentMethod : editingTx.paymentMethod,
        description: editDesc || null,
        billImageKey: finalBillImageKey ?? null,
        billImageUrl: finalBillImageKey ? null : editingTx.billImageUrl,
      };
      setData((prev) => {
        const replace = (arr: TransactionItem[]) => arr.map((t) => (t.id === editingTx.id ? updated : t));
        const oldAmt = editingTx.amount;
        const diff = amt - oldAmt;
        const isDebt = editingTx.type === "DEBT";
        return {
          ...prev,
          summary: {
            ...prev.summary,
            totalDebt: isDebt ? prev.summary.totalDebt + diff : prev.summary.totalDebt,
            totalReceived: !isDebt ? prev.summary.totalReceived + diff : prev.summary.totalReceived,
            outstandingBalance: isDebt ? prev.summary.outstandingBalance + diff : prev.summary.outstandingBalance - diff,
          },
          debtTransactions: isDebt ? replace(prev.debtTransactions) : prev.debtTransactions,
          paymentTransactions: !isDebt ? replace(prev.paymentTransactions) : prev.paymentTransactions,
          allTransactions: replace(prev.allTransactions),
        };
      });
      router.refresh();
      toast.success("Transaction updated");
      closeEditModal();
    } catch (err) {
      console.error("Edit transaction failed:", err);
      toast.error("Failed to edit transaction. Please try again.");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Handle Add Debt
  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(debtAmount);
    if (isNaN(amt) || amt <= 0) return;

    // Enforce 5MB BEFORE any server action — do not create transaction if image too large
    if (debtImageFile && debtImageFile.size > 5 * 1024 * 1024) {
      toast.error("Image is too large. Please select an image smaller than 5 MB.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addDebtAction({
        customerId: customer.id,
        amount: amt,
        billNumber: debtBillNo || undefined,
        description: debtDesc || undefined,
        transactionDate: kolkataDateTimeLocalToDate(debtDate),
      });

      if (!res.success || !res.transaction) {
        toast.error(res.error || "Failed to add debt. Please try again.");
        return;
      }

      let uploadedBillImageKey: string | null = null;
      if (debtImageFile && res.transaction.id) {
        try {
          const formData = new FormData();
          formData.append("transactionId", res.transaction.id);
          formData.append("customerId", customer.id);
          formData.append("file", debtImageFile);

          const uploadRes = await uploadBillImage(formData);

          if (uploadRes.success && uploadRes.billImageKey) {
            uploadedBillImageKey = uploadRes.billImageKey;
          } else {
            toast.error(uploadRes.error || "Failed to upload bill image. Transaction was saved without image.");
          }
        } catch (err) {
          console.error("Image upload failed:", err);
          toast.error("Image upload failed. Please try again.");
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
        transactionDate: kolkataDateTimeLocalToDate(debtDate),
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
            lastTransactionDate: kolkataDateTimeLocalToDate(debtDate),
          },
          debtTransactions: [...prev.debtTransactions, newTx],
          allTransactions: [...prev.allTransactions, newTx],
        };
      });
      router.refresh();

      setIsAddDebtOpen(false);
      setDebtAmount("");
      setDebtBillNo("");
      setDebtDesc("");
      setDebtImageUrl("");
      handleRemoveImage();
      toast.success("Bill added successfully");
    } catch (err) {
      console.error("Add debt failed:", err);
      toast.error("Failed to add debt. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Payment
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) return;

    setIsSubmitting(true);
    try {
      const res = await addPaymentAction({
        customerId: customer.id,
        amount: amt,
        paymentMethod,
        description: paymentDesc || undefined,
        transactionDate: kolkataDateTimeLocalToDate(paymentDate),
      });

      if (!res.success || !res.transaction) {
        toast.error(res.error || "Failed to add payment. Please try again.");
        return;
      }

      const newTx: TransactionItem = {
        id: res.transaction.id,
        type: "PAYMENT_RECEIVED",
        amount: amt,
        paymentMethod,
        description: paymentDesc || null,
        transactionDate: kolkataDateTimeLocalToDate(paymentDate),
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
            lastTransactionDate: kolkataDateTimeLocalToDate(paymentDate),
          },
          paymentTransactions: [...prev.paymentTransactions, newTx],
          allTransactions: [...prev.allTransactions, newTx],
        };
      });
      router.refresh();

      setIsAddPaymentOpen(false);
      setPaymentAmount("");
      setPaymentDesc("");
      toast.success("Payment added successfully");
    } catch (err) {
      console.error("Add payment failed:", err);
      toast.error("Failed to add payment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Transaction
  const handleDeleteTransaction = async () => {
    if (!deleteTxTarget) return;
    setIsDeletingTx(true);
    try {
      const res = await softDeleteTransactionAction({
        transactionId: deleteTxTarget.id,
        reason: "Deleted by user",
      });

      if (!res.success) {
        toast.error(res.error || "Failed to delete transaction. Please try again.");
        return;
      }
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
      router.refresh();
      const deletedId = deleteTxTarget.id;
      toast.undo("Transaction deleted successfully", async () => {
        const restoreRes = await restoreTransactionAction(deletedId);
        if (restoreRes.success) {
          router.refresh();
        }
      });
    } catch (err) {
      console.error("Delete transaction failed:", err);
      toast.error("Failed to delete transaction. Please try again.");
    } finally {
      setIsDeletingTx(false);
      setDeleteTxTarget(null);
    }
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
    <div className="space-y-8 sm:space-y-6 min-w-0 pb-24 sm:pb-0">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link
            href={`/billing/${customer.locationId}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold break-words">
              <span className="truncate">{customer.locationName}</span>
              <span className="shrink-0">/</span>
              <span className="shrink-0">{t("khataLedger")}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 sm:text-3xl flex items-center gap-2 break-words min-w-0">
              <span className="break-words min-w-0">{customer.name}</span>
            </h1>
            {/* Mobile outstanding directly below name — subtle bg, RED debt / GREEN advance */}
            <div className={`sm:hidden mt-1 inline-flex items-baseline gap-1.5 min-w-0 rounded-lg px-2.5 py-1 ${summary.outstandingBalance < 0 ? "bg-emerald-50/60" : summary.outstandingBalance === 0 ? "bg-slate-50" : "bg-red-50/60"}`}>
              <span className={`text-[15px] font-black whitespace-nowrap leading-none ${summary.outstandingBalance < 0 ? "text-emerald-600" : summary.outstandingBalance === 0 ? "text-slate-500" : "text-red-600"}`}>
                {formatCurrency(Math.abs(summary.outstandingBalance))}
              </span>
              <span className={`text-xs font-bold leading-none ${summary.outstandingBalance < 0 ? "text-emerald-600" : summary.outstandingBalance === 0 ? "text-slate-500" : "text-red-600"}`}>outstanding</span>
            </div>
          </div>
        </div>

        {/* Action Buttons: WhatsApp & Print — desktop only, hidden on mobile */}
        <div className="hidden sm:flex flex-row items-center gap-2 shrink-0">
          <button
            onClick={handleShareWhatsApp}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition min-h-[44px] min-w-0"
          >
            <Share2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("shareWhatsAppStatement")}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition min-h-[44px] min-w-0"
          >
            <Printer className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("printStatement")}</span>
          </button>
        </div>
      </div>

      {/* PERIOD SELECTOR — contained pill scroller */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 min-w-0 overflow-hidden">
        <span className="text-xs font-bold text-slate-600 shrink-0">{t("viewPeriod")}:</span>
        <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 w-full pb-1 -mb-1 scrollbar-thin sm:pb-0 sm:mb-0">
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

      {/* CUSTOMER ACCOUNT SUMMARY CARD — mobile borderless */}
      <div className="sm:rounded-3xl sm:border sm:border-slate-200 sm:bg-white sm:p-6 sm:shadow-sm min-w-0 overflow-hidden bg-transparent border-0 p-0 shadow-none">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4">
          {/* Customer Meta */}
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-600 min-w-0">
              <span className="flex items-center gap-1 font-mono min-w-0 break-all">
                <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" /> <span className="break-all">{customer.phone}</span>
              </span>
              {customer.address && (
                <span className="flex items-center gap-1 min-w-0 break-words">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" /> <span className="break-words">{customer.address}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 break-words">
              {t("accountCreatedAt", {
                user: customer.createdByName,
                date: formatDate(customer.createdAt, "dd MMM yyyy"),
              })}
            </p>
          </div>

          {/* Quick Transaction Modals CTA — desktop only (mobile uses floating bar) */}
          <div className="hidden sm:flex flex-row items-center gap-3 shrink-0">
            <button
              onClick={() => setIsAddDebtOpen(true)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-red-700 transition active:scale-98 min-h-[44px] min-w-0"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate">{t("addDebtBillBtn")}</span>
            </button>

            <button
              onClick={() => setIsAddPaymentOpen(true)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition active:scale-98 min-h-[44px] min-w-0"
            >
              <ArrowDownLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">{t("addPaymentBtn")}</span>
            </button>
          </div>
        </div>

        {/* Mobile: Account Summary — borderless, accent heading — RED debt / GREEN received */}
        <div className="sm:hidden mt-8 min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-4 w-1 rounded-full bg-slate-900"></div>
            <h3 className="text-sm font-black text-slate-900">Account Summary</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-red-50/60 p-3 text-center min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wide text-red-600 leading-tight">Total Debt</div>
              <div className="mt-1.5 text-base font-black text-red-600 whitespace-nowrap leading-tight">{formatCurrency(summary.totalDebt)}</div>
              <div className="mt-1 text-[11px] text-slate-500">{debtTransactions.length} bills</div>
            </div>
            <div className="rounded-xl bg-emerald-50/40 p-3 text-center min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 leading-tight">Received</div>
              <div className="mt-1.5 text-base font-black text-emerald-700 whitespace-nowrap leading-tight">{formatCurrency(summary.totalReceived)}</div>
              <div className="mt-1 text-[11px] text-slate-500">{paymentTransactions.length} payments</div>
            </div>
          </div>
        </div>

        {/* Desktop: 3 Metric Cards (locked) */}
        <div className="hidden sm:grid mt-6 grid-cols-3 gap-4 border-t border-slate-100 pt-5">
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 min-w-0 overflow-hidden">
            <span className="text-xs font-bold text-slate-500">{t("totalDebtBills")}</span>
            <div className="mt-1 text-2xl font-black text-slate-900 break-words">
              {formatCurrency(summary.totalDebt)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 break-words">
              {t("billsAddedCount", { count: debtTransactions.length })}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50/60 p-4 border border-emerald-100 min-w-0 overflow-hidden">
            <span className="text-xs font-bold text-emerald-800">{t("paymentsReceived")}</span>
            <div className="mt-1 text-2xl font-black text-emerald-700 break-words">
              {formatCurrency(summary.totalReceived)}
            </div>
            <p className="text-[11px] text-emerald-600 mt-0.5 break-words">
              {t("paymentsCollectedCount", { count: paymentTransactions.length })}
            </p>
          </div>

          <div className={`rounded-2xl p-4 border min-w-0 overflow-hidden ${isAdvance ? "bg-emerald-50 border-emerald-200" : "bg-red-50/80 border-red-200"}`}>
            <span className={`text-xs font-bold ${isAdvance ? "text-emerald-800" : "text-red-800"}`}>
              {isAdvance ? t("advanceCreditBalance") : t("outstandingBalanceDue")}
            </span>
            <div className={`mt-1 text-2xl font-black break-words ${isAdvance ? "text-emerald-800" : "text-red-700"}`}>
              {isAdvance ? formatCurrency(Math.abs(summary.outstandingBalance)) : formatCurrency(summary.outstandingBalance)}
            </div>
            <p className={`text-[11px] mt-0.5 break-words ${isAdvance ? "text-emerald-600" : "text-red-500"}`}>
              {isAdvance ? t("excessAdvanceMsg") : t("balanceFormulaMsg")}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile subtle divider — separates Account Summary from Transactions */}
      <div className="sm:hidden h-px bg-slate-200/70"></div>

      {/* Desktop: TWO SEPARATED VISUAL SECTIONS (LEFT: DEBT | RIGHT: PAYMENT RECEIVED) — locked */}
      <div className="hidden sm:grid sm:gap-6 lg:grid-cols-2 min-w-0">
        {/* LEFT COLUMN: DEBT (BILLS & CREDIT PURCHASES) */}
        <div className="rounded-2xl sm:rounded-3xl border border-red-100 bg-white shadow-xs overflow-hidden min-w-0">
          <div className="bg-red-50/80 px-4 sm:px-6 py-4 border-b border-red-100 flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white text-xs font-bold">
                D
              </span>
              <h3 className="text-sm sm:text-base font-black text-red-950 truncate">{t("debtColumnTitle")}</h3>
            </div>
            <span className="text-xs font-bold text-red-700 shrink-0 whitespace-nowrap">
              {t("entriesCount", { count: debtTransactions.length })}
            </span>
          </div>

          {/* Mobile compact Debt summary — replaces full list on phone */}
          <div className="sm:hidden p-4 space-y-3">
            <div className="text-center">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total Debt</div>
              <div className="mt-1 text-2xl font-black text-red-600 whitespace-nowrap">{formatCurrency(summary.totalDebt)}</div>
            </div>
            <Link
              href={`/billing/${customer.locationId}/customers/${customer.id}/history`}
              className="flex w-full min-h-[44px] items-center justify-center gap-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-xs hover:bg-slate-800 transition"
            >
              View All Transactions <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Desktop full Debt list — hidden on mobile */}
          <div className="hidden sm:block divide-y divide-slate-100">
            {displayTxs.filter((tx) => tx.type === "DEBT").length > 0 ? (
              displayTxs.filter((tx) => tx.type === "DEBT").map((txItem) => (
                <div key={txItem.id} className="p-3 sm:p-5 hover:bg-slate-50/60 transition flex items-start justify-between gap-3 sm:gap-4 min-w-0">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      {txItem.billNumber ? (
                        <span className="rounded-lg bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white break-all">
                          {txItem.billNumber}
                        </span>
                      ) : null}
                      <span className="text-xs font-semibold text-slate-800 break-words min-w-0">
                        {txItem.description || "Purchase Bill"}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 min-w-0 break-words">
                      <span className="break-words">{formatDate(txItem.transactionDate, "dd MMM yyyy, hh:mm a")}</span>
                      <span className="shrink-0">•</span>
                      <span className="break-words">{t("addedBy")}: <strong className="text-slate-700">{txItem.createdByName}</strong></span>
                    </div>

                    {(txItem.billImageKey || txItem.billImageUrl) && (
                      <button
                        onClick={() => handleViewBillImage(txItem)}
                        className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] h-11 w-11 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition mt-1"
                        title={t("viewAttachedBillPhoto")}
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-start gap-1.5 sm:gap-2 shrink-0">
                    <div className="text-right min-w-0">
                      <div className="text-sm sm:text-base font-black text-red-600 whitespace-nowrap">
                        {formatCurrency(txItem.amount)}
                      </div>
                      {txItem.runningBalance !== undefined && (
                        <div className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
                          {t("balance")}: {formatCurrency(txItem.runningBalance)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => openEditModal(txItem)}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition shrink-0"
                      title={t("edit")}
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTxTarget(txItem)}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-600 transition shrink-0"
                      title="Delete Bill"
                      aria-label="Delete"
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
        <div className="rounded-2xl sm:rounded-3xl border border-emerald-100 bg-white shadow-xs overflow-hidden min-w-0">
          <div className="bg-emerald-50/80 px-4 sm:px-6 py-4 border-b border-emerald-100 flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white text-xs font-bold">
                P
              </span>
              <h3 className="text-sm sm:text-base font-black text-emerald-950 truncate">{t("paymentColumnTitle")}</h3>
            </div>
            <span className="text-xs font-bold text-emerald-700 shrink-0 whitespace-nowrap">
              {t("entriesCount", { count: paymentTransactions.length })}
            </span>
          </div>

          {/* Mobile compact Payments summary */}
          <div className="sm:hidden p-4 space-y-3">
            <div className="text-center">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Payments Received</div>
              <div className="mt-1 text-2xl font-black text-emerald-600 whitespace-nowrap">{formatCurrency(summary.totalReceived)}</div>
              <div className="mt-1 text-[11px] text-slate-400">{paymentTransactions.length} payment{paymentTransactions.length !== 1 ? "s" : ""} collected</div>
            </div>
            <Link
              href={`/billing/${customer.locationId}/customers/${customer.id}/history`}
              className="flex w-full min-h-[44px] items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              View All Transactions <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="hidden sm:block divide-y divide-slate-100">
            {displayTxs.filter((tx) => tx.type === "PAYMENT_RECEIVED").length > 0 ? (
              displayTxs.filter((tx) => tx.type === "PAYMENT_RECEIVED").map((txItem) => (
                <div key={txItem.id} className="p-3 sm:p-5 hover:bg-slate-50/60 transition flex items-start justify-between gap-3 sm:gap-4 min-w-0">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 break-all">
                        {txItem.paymentMethod || "CASH"}
                      </span>
                      {txItem.description && (
                        <span className="text-xs font-semibold text-slate-800 break-words min-w-0">{txItem.description}</span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 min-w-0 break-words">
                      <span className="break-words">{formatDate(txItem.transactionDate, "dd MMM yyyy, hh:mm a")}</span>
                      <span className="shrink-0">•</span>
                      <span className="break-words">{t("addedBy")}: <strong className="text-slate-700">{txItem.createdByName}</strong></span>
                    </div>
                    {(txItem.billImageKey || txItem.billImageUrl) && (
                      <button
                        onClick={() => handleViewBillImage(txItem)}
                        className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] h-11 w-11 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition mt-1"
                        title={t("viewAttachedBillPhoto")}
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-start gap-1.5 sm:gap-2 shrink-0">
                    <div className="text-right min-w-0">
                      <div className="text-sm sm:text-base font-black text-emerald-600 whitespace-nowrap">
                        {formatCurrency(txItem.amount)}
                      </div>
                      {txItem.runningBalance !== undefined && (
                        <div className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
                          {t("balance")}: {formatCurrency(txItem.runningBalance)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => openEditModal(txItem)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      title={t("edit")}
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTxTarget(txItem)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-600 transition"
                      title="Delete Payment"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs break-words">
                {t("noPaymentRecords")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile unified Transactions — borderless ledger */}
      <div className="sm:hidden space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-1 rounded-full bg-slate-900"></div>
          <h3 className="text-sm font-black text-slate-900">Transactions</h3>
          <span className="ml-auto text-xs font-bold text-slate-400">
            {(() => {
              const all = displayTxs.length;
              if (mobileTxFilter === "ALL") return `${all}`;
              if (mobileTxFilter === "DEBT") return `${displayTxs.filter((t) => t.type === "DEBT").length}`;
              return `${displayTxs.filter((t) => t.type === "PAYMENT_RECEIVED").length}`;
            })()}
          </span>
        </div>

        {/* Segmented filter */}
        <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
          {([
            ["ALL", "All"],
            ["DEBT", "Debt"],
            ["PAYMENT_RECEIVED", "Received"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setMobileTxFilter(value);
                setMobileTxVisible(10);
              }}
              className={`flex-1 min-h-[44px] rounded-lg px-3 py-2 text-xs font-bold transition ${
                mobileTxFilter === value ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Transaction list — clean vertical ledger */}
        {(() => {
          const filtered = mobileTxFilter === "ALL" ? displayTxs : displayTxs.filter((t) => t.type === mobileTxFilter);
          const visible = filtered.slice(0, mobileTxVisible);
          if (filtered.length === 0) {
            return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">No transactions</div>;
          }
          return (
            <>
              <div className="divide-y divide-slate-100">
                {visible.map((txItem) => {
                  const isDebt = txItem.type === "DEBT";
                  return (
                    <div key={txItem.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-black whitespace-nowrap ${isDebt ? "text-red-600" : "text-emerald-600"}`}>
                          {isDebt ? "" : "+ "}{formatCurrency(txItem.amount)}
                        </div>
                        <div className="text-xs font-semibold text-slate-700 truncate">
                          {isDebt ? (txItem.description || `Bill ${txItem.billNumber || ""}`.trim() || "Bill") : txItem.description ? txItem.description : `Payment received${txItem.paymentMethod ? ` • ${txItem.paymentMethod}` : ""}`}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {txItem.createdByName} • {formatDate(txItem.transactionDate, "dd MMM • hh:mm a")}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {(txItem.billImageKey || txItem.billImageUrl) && (
                          <button
                            onClick={() => handleViewBillImage(txItem)}
                            className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition shrink-0"
                            aria-label={t("viewBillImage")}
                            title={t("viewBillImage")}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => openEditModal(txItem)} className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteTxTarget(txItem)} className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-600" aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {filtered.length > visible.length && (
                <button onClick={() => setMobileTxVisible((v) => v + 10)} className="w-full mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  View all transactions ↓
                </button>
              )}
            </>
          );
        })()}
      </div>

      {/* Mobile floating action bar — Add Debt + Add Payment (phone only) */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-t border-slate-200 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex gap-3">
        <button
          onClick={() => setIsAddDebtOpen(true)}
          className="flex-1 inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-red-600 px-3 py-3 text-[13px] font-bold text-white shadow-lg hover:bg-red-700 active:scale-[0.98] transition whitespace-nowrap"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Add Debt</span>
        </button>
        <button
          onClick={() => setIsAddPaymentOpen(true)}
          className="flex-1 inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-3 text-[13px] font-bold text-white shadow-lg hover:bg-emerald-700 active:scale-[0.98] transition whitespace-nowrap"
        >
          <ArrowDownLeft className="h-4 w-4 shrink-0" />
          <span>Add Payment</span>
        </button>
      </div>

      {/* ADD DEBT MODAL */}
      {isAddDebtOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
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
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => debtCameraInputRef.current?.click()}
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition min-h-[44px]"
                  >
                    📷 {t("takePhoto")}
                  </button>
                  <button
                    type="button"
                    onClick={() => debtFileInputRef.current?.click()}
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition min-h-[44px]"
                  >
                    🖼️ {t("uploadFromGallery")}
                  </button>
                </div>
                <input
                  type="file"
                  ref={debtCameraInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <input
                  type="file"
                  ref={debtFileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
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

      {/* EDIT TRANSACTION MODAL */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900">
              {editingTx.type === "DEBT"
                ? t("addDebtModalTitle", { name: customer.name })
                : t("addPaymentModalTitle", { name: customer.name })}{" "}
              <span className="text-xs font-normal text-slate-500">— {t("edit")}</span>
            </h3>
            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700">
                  {editingTx.type === "DEBT" ? t("debtAmountLabel") : t("paymentAmountLabel")} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className={`mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-black focus:border-slate-900 focus:outline-none ${editingTx.type === "DEBT" ? "text-red-600" : "text-emerald-600"}`}
                />
              </div>
              {editingTx.type === "DEBT" ? (
                <div>
                  <label className="text-xs font-bold text-slate-700">{t("debtBillNoLabel")}</label>
                  <input
                    type="text"
                    placeholder={t("debtBillNoPlaceholder")}
                    value={editBillNo}
                    onChange={(e) => setEditBillNo(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none uppercase font-mono"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-700">{t("paymentMethodLabel")} *</label>
                  <select
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value as PaymentMethod)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none"
                  >
                    <option value={PaymentMethod.CASH}>{t("paymentMethodCash")}</option>
                    <option value={PaymentMethod.UPI}>{t("paymentMethodUPI")}</option>
                    <option value={PaymentMethod.BANK_TRANSFER}>{t("paymentMethodBank")}</option>
                    <option value={PaymentMethod.OTHER}>{t("paymentMethodOther")}</option>
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-700">{editingTx.type === "DEBT" ? t("debtDescLabel") : t("paymentNotesLabel")}</label>
                <input
                  type="text"
                  placeholder={editingTx.type === "DEBT" ? t("debtDescPlaceholder") : t("paymentNotesPlaceholder")}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">{t("billImageLabel")}</label>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => editCameraInputRef.current?.click()}
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition min-h-[44px]"
                  >
                    📷 {t("takePhoto")}
                  </button>
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition min-h-[44px]"
                  >
                    🖼️ {t("uploadFromGallery")}
                  </button>
                </div>
                <input type="file" ref={editCameraInputRef} accept="image/*" capture="environment" onChange={handleEditFileSelect} className="hidden" />
                <input type="file" ref={editFileInputRef} accept="image/jpeg,image/png,image/webp" onChange={handleEditFileSelect} className="hidden" />
                {editImagePreview ? (
                  <div className="mt-2 relative inline-block">
                    <Image src={editImagePreview} alt="Bill preview" width={200} height={150} className="rounded-xl border border-slate-200 object-cover" />
                    <button type="button" onClick={handleRemoveEditImage} className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : editingTx.billImageKey && !editRemoveImage ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">{t("viewAttachedBillPhoto")} ✓</span>
                    <button type="button" onClick={() => handleViewBillImage(editingTx)} className="text-xs font-bold text-sky-600 hover:underline">
                      {t("viewBillImage")}
                    </button>
                    <button type="button" onClick={() => setEditRemoveImage(true)} className="text-xs font-bold text-red-600 hover:underline">
                      {t("delete")}
                    </button>
                  </div>
                ) : editRemoveImage ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Image will be removed on save</span>
                    <button type="button" onClick={() => setEditRemoveImage(false)} className="text-xs font-bold text-sky-600 hover:underline">Undo</button>
                  </div>
                ) : null}
                <p className="text-[10px] text-slate-400 mt-1">{t("billImageHint")}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Change reason *</label>
                <input
                  type="text"
                  required
                  placeholder="Reason for editing"
                  value={editChangeReason}
                  onChange={(e) => setEditChangeReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeEditModal} className="w-1/3 rounded-xl border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[44px]">
                  {t("cancel")}
                </button>
                <button type="submit" disabled={isEditSubmitting} className="w-2/3 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 min-h-[44px]">
                  {isEditSubmitting ? t("loading") : t("save")}
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