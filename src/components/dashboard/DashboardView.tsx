"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Receipt,
  Boxes,
  ArrowRight,
  X,
  FileText,
  Loader2,
  Plus,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useTranslation } from "@/lib/i18n";
import { getBillImageSignedUrl } from "@/server/actions/upload.actions";
import { getAllTransactionsAction } from "@/server/actions/transaction.actions";
import { getAllMovementsAction } from "@/server/actions/inventory.actions";
import { ImageViewer } from "@/components/shared/ImageViewer";
import { useToast } from "@/components/shared/ToastContext";

interface TransactionItem {
  id: string;
  type: string;
  amount: number;
  paymentMethod?: string | null;
  transactionDate: string | Date;
  customerName: string;
  customerId: string;
  createdByName: string;
  billImageKey?: string | null;
}

interface MovementItem {
  id: string;
  type: string;
  quantity: number;
  removalReason?: string | null;
  movementDate: string | Date;
  itemName: string;
  itemUnit: string;
  createdByName: string;
}

export interface DashboardMetrics {
  userGreetingName?: string;
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  isDbConnected: boolean;
  recentTransactions: TransactionItem[];
  recentMovements: MovementItem[];
  totalTransactionCount: number;
  totalMovementCount: number;
}

export function DashboardView({ data }: { data: DashboardMetrics }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [selectedImageView, setSelectedImageView] = useState<string | null>(null);

  // View All modals
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showMovementsModal, setShowMovementsModal] = useState(false);

  // Lazy-loaded data for View All modals
  const [allTransactions, setAllTransactions] = useState<TransactionItem[] | null>(null);
  const [allMovements, setAllMovements] = useState<MovementItem[] | null>(null);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const {
    userGreetingName,
    isDbConnected,
    recentTransactions,
    recentMovements,
    totalTransactionCount,
    totalMovementCount,
  } = data;

  const greetingText = userGreetingName
    ? t("greetingNamed", { name: userGreetingName })
    : t("greetingFallback");

  const handleViewBillImage = async (tx: { id: string; customerId: string }) => {
    const res = await getBillImageSignedUrl({
      transactionId: tx.id,
      customerId: tx.customerId,
    });
    if (res.success && res.url) {
      setSelectedImageView(res.url);
    } else {
      toast.error(res.error || "Failed to load bill image");
    }
  };

  // Lazy-load all transactions when View All is clicked
  const handleShowAllTransactions = useCallback(async () => {
    setShowTransactionsModal(true);
    if (allTransactions !== null) return; // already loaded
    setLoadingTransactions(true);
    try {
      const res = await getAllTransactionsAction();
      if (res.success && res.transactions) {
        setAllTransactions(res.transactions);
      }
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setLoadingTransactions(false);
    }
  }, [allTransactions, toast]);

  // Lazy-load all movements when View All is clicked
  const handleShowAllMovements = useCallback(async () => {
    setShowMovementsModal(true);
    if (allMovements !== null) return; // already loaded
    setLoadingMovements(true);
    try {
      const res = await getAllMovementsAction();
      if (res.success && res.movements) {
        setAllMovements(res.movements);
      }
    } catch {
      toast.error("Failed to load movements");
    } finally {
      setLoadingMovements(false);
    }
  }, [allMovements, toast]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showTransactionsModal || showMovementsModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [showTransactionsModal, showMovementsModal]);

  // Close modal on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowTransactionsModal(false);
      setShowMovementsModal(false);
    }
  }, []);

  useEffect(() => {
    if (showTransactionsModal || showMovementsModal) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [showTransactionsModal, showMovementsModal, handleKeyDown]);

  const hasMoreTransactions = totalTransactionCount > recentTransactions.length;
  const hasMoreMovements = totalMovementCount > recentMovements.length;

  return (
    <div className="p-3 sm:p-8 space-y-5 sm:space-y-8 max-w-7xl mx-auto min-w-0">
      {!isDbConnected && (
        <div className="rounded-2xl sm:rounded-3xl border border-amber-300 bg-amber-50 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4 min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white font-black">
              !
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950">Database Setup Required</h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Run <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold">npx prisma db push && npx prisma db seed</code> in your terminal once PostgreSQL is active.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-amber-900 bg-amber-200/60 px-3 py-1.5 rounded-xl">
            Awaiting DB Connection
          </span>
        </div>
      )}

      {/* Mobile greeting — compact, friendly */}
      <div className="block md:hidden min-w-0">
        <h1 className="text-[22px] leading-tight font-black text-slate-900 tracking-tight">Namaste 🙏</h1>
        <p className="text-xs text-slate-500 mt-1 leading-snug">Manage your shop with ease.</p>
      </div>
      {/* Desktop greeting — locked */}
      <div className="hidden md:flex flex-wrap items-center justify-between gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          <span className="text-xs font-bold text-sky-600 uppercase tracking-widest">
            {t("storeCommandCenter")}
          </span>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight break-words">
            {greetingText}
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-snug break-words">
            {t("dashboardSubtitle")}
          </p>
        </div>
      </div>

      {/* Mobile module cards — compact, tappable, short descriptions */}
      <div className="grid md:hidden grid-cols-1 gap-3 min-w-0">
        <Link href="/billing" className="flex items-center gap-3 rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-4 text-white shadow-md border border-slate-700/50 active:scale-[0.99] transition min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
            <Receipt className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black tracking-tight leading-none">BILLING & KHATA</div>
            <div className="text-[11px] text-slate-300 leading-tight mt-0.5">Customers, dues & payments</div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-sky-400" />
        </Link>
        <Link href="/inventory" className="flex items-center gap-3 rounded-2xl bg-linear-to-br from-sky-950 via-slate-900 to-sky-950 p-4 text-white shadow-md border border-sky-900/50 active:scale-[0.99] transition min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black tracking-tight leading-none">INVENTORY & STOCK</div>
            <div className="text-[11px] text-slate-300 leading-tight mt-0.5">Manage your shop stock</div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-emerald-400" />
        </Link>
      </div>

      {/* Desktop module cards — locked */}
      <div className="hidden md:grid grid-cols-2 gap-6 min-w-0">
        {/* 1. BILLING CARD */}
        <Link
          href="/billing"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl transition-all hover:scale-101 hover:shadow-2xl active:scale-99 border border-slate-700/50 min-w-0"
        >
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-black text-sky-300 border border-sky-400/30">
                {t("module1Badge")}
              </span>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur group-hover:bg-sky-500 transition">
                <Receipt className="h-6 w-6" />
              </div>
            </div>

            <h2 className="mt-6 text-3xl font-black tracking-tight break-words">{t("module1Title")}</h2>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed break-words">
              {t("module1Desc")}
            </p>
          </div>

          <div className="mt-8 border-t border-slate-700/60 pt-6">
            <div className="flex items-center justify-between text-xs font-bold text-sky-400">
              <span>{t("openBillingLocations")}</span>
              <ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </Link>

        {/* 2. INVENTORY CARD */}
        <Link
          href="/inventory"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-linear-to-br from-sky-950 via-slate-900 to-sky-950 p-8 text-white shadow-xl transition-all hover:scale-101 hover:shadow-2xl active:scale-99 border border-sky-900/50 min-w-0"
        >
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-300 border border-emerald-400/30">
                {t("module2Badge")}
              </span>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur group-hover:bg-emerald-500 transition">
                <Boxes className="h-6 w-6" />
              </div>
            </div>

            <h2 className="mt-6 text-3xl font-black tracking-tight break-words">{t("module2Title")}</h2>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed break-words">
              {t("module2Desc")}
            </p>
          </div>

          <div className="mt-8 border-t border-slate-700/60 pt-6">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
              <span>{t("manageShopStock")}</span>
              <ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </Link>
      </div>

      <div className="flex justify-end -mt-1 sm:mt-0 md:mt-0">
        <Link href="/members" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition min-h-[32px] px-2 -mx-2">
          Manage Team <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Mobile Quick Actions — thumb-friendly, side-by-side */}
      <div className="block md:hidden min-w-0">
        <h3 className="text-[11px] font-black tracking-widest text-slate-500 uppercase mb-2">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/billing" className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 p-3 min-h-[48px] text-sm font-bold text-slate-900 shadow-xs active:scale-[0.98] transition min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"><Plus className="h-4 w-4" /></span>
            <span className="truncate">Add Debt</span>
          </Link>
          <Link href="/billing" className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 p-3 min-h-[48px] text-sm font-bold text-slate-900 shadow-xs active:scale-[0.98] transition min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><ArrowRight className="h-4 w-4 rotate-90" /></span>
            <span className="truncate">Add Payment</span>
          </Link>
          <Link href="/billing" className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 p-3 min-h-[48px] text-sm font-bold text-slate-900 shadow-xs active:scale-[0.98] transition min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><FileText className="h-4 w-4" /></span>
            <span className="truncate">Customer</span>
          </Link>
          <Link href="/inventory" className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 p-3 min-h-[48px] text-sm font-bold text-slate-900 shadow-xs active:scale-[0.98] transition min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Boxes className="h-4 w-4" /></span>
            <span className="truncate">Stock</span>
          </Link>
        </div>
      </div>

      {/* DASHBOARD CONTENT: Recent Transactions + Inventory Summary */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 min-w-0">
        {/* Recent Transactions Section */}
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs space-y-3 sm:space-y-4 min-w-0">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 sm:pb-4 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Receipt className="h-5 w-5 shrink-0 text-sky-600" />
              <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">{t("recentTransactions")}</h3>
            </div>
            <Link href="/reports" className="text-xs font-bold text-sky-600 hover:underline shrink-0">
              {t("viewReports")}
            </Link>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((tx) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 truncate">
                      {tx.customerName} ({tx.type === "DEBT" ? t("billLabel") : tx.paymentMethod || t("paymentLabel")})
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400">
                        {formatDate(tx.transactionDate, "dd MMM, hh:mm a")} &bull; {t("addedBy")}: {tx.createdByName}
                      </span>
                      {tx.billImageKey && (
                        <button
                          onClick={() => handleViewBillImage(tx)}
                          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] h-11 w-11 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100 transition shrink-0"
                          title={t("viewBillImage")}
                          aria-label={t("viewBillImage")}
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <span
                    className={`font-black shrink-0 ml-2 ${
                      tx.type === "DEBT" ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {tx.type === "DEBT" ? "+" : "-"}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 py-4 text-center">{t("noRecentTransactions")}</p>
            )}
          </div>

          {/* View All Button */}
          {hasMoreTransactions && (
            <button
              onClick={handleShowAllTransactions}
              className="flex items-center justify-center gap-1.5 w-full pt-2 text-xs font-bold text-sky-600 hover:text-sky-700 transition min-h-[44px]"
            >
              <span>{t("viewAll")}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Inventory Overview Section */}
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs space-y-3 sm:space-y-4 min-w-0">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 sm:pb-4 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Boxes className="h-5 w-5 shrink-0 text-emerald-600" />
              <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">{t("inventoryStockSummary")}</h3>
            </div>
            <Link href="/inventory" className="text-xs font-bold text-emerald-600 hover:underline shrink-0">
              {t("viewItemsArrow")}
            </Link>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {recentMovements.length > 0 ? (
              recentMovements.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">
                      {m.itemName} ({m.type === "ADD_STOCK" ? t("stockInflow") : t("stockOutflow")})
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {formatDate(m.movementDate, "dd MMM, hh:mm a")} &bull; {t("addedBy")}: {m.createdByName}
                    </span>
                  </div>
                  <span
                    className={`font-black shrink-0 ml-2 ${
                      m.type === "ADD_STOCK" ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {m.type === "ADD_STOCK" ? "+" : "-"}{m.quantity} {m.itemUnit}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 py-4 text-center">{t("noRecentMovements")}</p>
            )}
          </div>

          {/* View All Button */}
          {hasMoreMovements && (
            <button
              onClick={handleShowAllMovements}
              className="flex items-center justify-center gap-1.5 w-full pt-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition min-h-[44px]"
            >
              <span>{t("viewAll")}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* TRANSACTIONS VIEW ALL MODAL */}
      {showTransactionsModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-sm font-black text-slate-900">{t("recentTransactions")}</h3>
                <p className="text-[11px] text-slate-400">
                  {loadingTransactions ? "Loading..." : `${allTransactions?.length ?? 0} ${t("viewAllShowing")}`}
                </p>
              </div>
              <button
                onClick={() => setShowTransactionsModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-slate-100 text-xs overscroll-contain">
              {loadingTransactions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
                </div>
              ) : (
                (allTransactions ?? []).map((tx) => (
                  <div key={tx.id} className="py-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 truncate">
                        {tx.customerName} ({tx.type === "DEBT" ? t("billLabel") : tx.paymentMethod || t("paymentLabel")})
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-400">
                          {formatDate(tx.transactionDate, "dd MMM, hh:mm a")} &bull; {t("addedBy")}: {tx.createdByName}
                        </span>
                        {tx.billImageKey && (
                          <button
                            onClick={() => handleViewBillImage(tx)}
                            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] h-11 w-11 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition shrink-0"
                            title={t("viewBillImage")}
                            aria-label={t("viewBillImage")}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <span
                      className={`font-black shrink-0 ml-2 ${
                        tx.type === "DEBT" ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {tx.type === "DEBT" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 shrink-0">
              <button
                onClick={() => setShowTransactionsModal(false)}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white hover:bg-slate-800 transition min-h-[44px]"
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOVEMENTS VIEW ALL MODAL */}
      {showMovementsModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-sm font-black text-slate-900">{t("inventoryStockSummary")}</h3>
                <p className="text-[11px] text-slate-400">
                  {loadingMovements ? "Loading..." : `${allMovements?.length ?? 0} ${t("viewAllShowing")}`}
                </p>
              </div>
              <button
                onClick={() => setShowMovementsModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-slate-100 text-xs overscroll-contain">
              {loadingMovements ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                </div>
              ) : (
                (allMovements ?? []).map((m) => (
                  <div key={m.id} className="py-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 truncate">
                        {m.itemName} ({m.type === "ADD_STOCK" ? t("stockInflow") : t("stockOutflow")})
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {formatDate(m.movementDate, "dd MMM, hh:mm a")} &bull; {t("addedBy")}: {m.createdByName}
                      </span>
                    </div>
                    <span
                      className={`font-black shrink-0 ml-2 ${
                        m.type === "ADD_STOCK" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {m.type === "ADD_STOCK" ? "+" : "-"}{m.quantity} {m.itemUnit}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 shrink-0">
              <button
                onClick={() => setShowMovementsModal(false)}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white hover:bg-slate-800 transition min-h-[44px]"
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Image Viewer */}
      <ImageViewer
        src={selectedImageView || ""}
        alt="Bill Image"
        isOpen={!!selectedImageView}
        onClose={() => setSelectedImageView(null)}
      />
    </div>
  );
}
