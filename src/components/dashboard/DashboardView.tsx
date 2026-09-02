"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Receipt,
  Boxes,
  ArrowRight,
  X,
  FileText,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useTranslation } from "@/lib/i18n";
import { getBillImageSignedUrl } from "@/server/actions/upload.actions";
import { ImageViewer } from "@/components/shared/ImageViewer";
import { useToast } from "@/components/shared/ToastContext";

export interface DashboardMetrics {
  userGreetingName?: string;
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  isDbConnected: boolean;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    paymentMethod?: string | null;
    transactionDate: string | Date;
    customerName: string;
    customerId: string;
    createdByName: string;
    billImageKey?: string | null;
  }>;
  allTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    paymentMethod?: string | null;
    transactionDate: string | Date;
    customerName: string;
    customerId: string;
    createdByName: string;
    billImageKey?: string | null;
  }>;
  recentMovements: Array<{
    id: string;
    type: string;
    quantity: number;
    removalReason?: string | null;
    movementDate: string | Date;
    itemName: string;
    itemUnit: string;
    createdByName: string;
  }>;
  allMovements: Array<{
    id: string;
    type: string;
    quantity: number;
    removalReason?: string | null;
    movementDate: string | Date;
    itemName: string;
    itemUnit: string;
    createdByName: string;
  }>;
}

export function DashboardView({ data }: { data: DashboardMetrics }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [selectedImageView, setSelectedImageView] = useState<string | null>(null);

  // View All modals
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showMovementsModal, setShowMovementsModal] = useState(false);

  const {
    userGreetingName,
    isDbConnected,
    recentTransactions,
    allTransactions,
    recentMovements,
    allMovements,
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

  const hasMoreTransactions = allTransactions.length > recentTransactions.length;
  const hasMoreMovements = allMovements.length > recentMovements.length;

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {!isDbConnected && (
        <div className="rounded-3xl border border-amber-300 bg-amber-50 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
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

      {/* Dynamic User Greeting & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-sky-600 uppercase tracking-widest">
            {t("storeCommandCenter")}
          </span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight sm:text-4xl">
            {greetingText}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t("dashboardSubtitle")}
          </p>
        </div>
      </div>

      {/* TWO PRIMARY MODULE CARDS */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 1. BILLING CARD */}
        <Link
          href="/billing"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl transition-all hover:scale-101 hover:shadow-2xl active:scale-99 border border-slate-700/50"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-black text-sky-300 border border-sky-400/30">
                {t("module1Badge")}
              </span>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur group-hover:bg-sky-500 transition">
                <Receipt className="h-6 w-6" />
              </div>
            </div>

            <h2 className="mt-6 text-3xl font-black tracking-tight">{t("module1Title")}</h2>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              {t("module1Desc")}
            </p>
          </div>

          <div className="mt-8 border-t border-slate-700/60 pt-6">
            <div className="flex items-center justify-between text-xs font-bold text-sky-400">
              <span>{t("openBillingLocations")}</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </Link>

        {/* 2. INVENTORY CARD */}
        <Link
          href="/inventory"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-linear-to-br from-sky-950 via-slate-900 to-sky-950 p-8 text-white shadow-xl transition-all hover:scale-101 hover:shadow-2xl active:scale-99 border border-sky-900/50"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-300 border border-emerald-400/30">
                {t("module2Badge")}
              </span>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur group-hover:bg-emerald-500 transition">
                <Boxes className="h-6 w-6" />
              </div>
            </div>

            <h2 className="mt-6 text-3xl font-black tracking-tight">{t("module2Title")}</h2>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              {t("module2Desc")}
            </p>
          </div>

          <div className="mt-8 border-t border-slate-700/60 pt-6">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
              <span>{t("manageShopStock")}</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </Link>
      </div>

      {/* DASHBOARD CONTENT: Recent Transactions + Inventory Summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Transactions Section */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-sky-600" />
              <h3 className="text-base font-black text-slate-900">{t("recentTransactions")}</h3>
            </div>
            <Link href="/reports" className="text-xs font-bold text-sky-600 hover:underline">
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
                        {formatDate(tx.transactionDate, "dd MMM, hh:mm a")} \u{2022} {t("addedBy")}: {tx.createdByName}
                      </span>
                      {tx.billImageKey && (
                        <button
                          onClick={() => handleViewBillImage(tx)}
                          className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100 transition"
                          title={t("viewBillImage")}
                        >
                          <FileText className="h-3 w-3" />
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
              onClick={() => setShowTransactionsModal(true)}
              className="flex items-center justify-center gap-1.5 w-full pt-2 text-xs font-bold text-sky-600 hover:text-sky-700 transition min-h-[44px]"
            >
              <span>{t("viewAll")}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Inventory Overview Section */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-black text-slate-900">{t("inventoryStockSummary")}</h3>
            </div>
            <Link href="/inventory" className="text-xs font-bold text-emerald-600 hover:underline">
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
                      {formatDate(m.movementDate, "dd MMM, hh:mm a")} \u{2022} {t("addedBy")}: {m.createdByName}
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
              onClick={() => setShowMovementsModal(true)}
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
                <p className="text-[11px] text-slate-400">{allTransactions.length} {t("viewAllShowing")}</p>
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
              {allTransactions.map((tx) => (
                <div key={tx.id} className="py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 truncate">
                      {tx.customerName} ({tx.type === "DEBT" ? t("billLabel") : tx.paymentMethod || t("paymentLabel")})
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400">
                        {formatDate(tx.transactionDate, "dd MMM, hh:mm a")} \u{2022} {t("addedBy")}: {tx.createdByName}
                      </span>
                      {tx.billImageKey && (
                        <button
                          onClick={() => handleViewBillImage(tx)}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition"
                          title={t("viewBillImage")}
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
              ))}
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
                <p className="text-[11px] text-slate-400">{allMovements.length} {t("viewAllShowing")}</p>
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
              {allMovements.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 truncate">
                      {m.itemName} ({m.type === "ADD_STOCK" ? t("stockInflow") : t("stockOutflow")})
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {formatDate(m.movementDate, "dd MMM, hh:mm a")} \u{2022} {t("addedBy")}: {m.createdByName}
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
              ))}
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
