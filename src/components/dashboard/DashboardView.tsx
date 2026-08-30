"use client";

import Link from "next/link";
import {
  Receipt,
  Boxes,
  Users,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Clock,
  Building2,
} from "lucide-react";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";
import { useTranslation } from "@/lib/i18n";

export interface DashboardMetrics {
  userGreetingName?: string;
  totalCustomers: number;
  totalDebt: number;
  totalReceived: number;
  outstandingBalance: number;
  totalLocations: number;
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
    createdByName: string;
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
}

export function DashboardView({ data }: { data: DashboardMetrics }) {
  const { t } = useTranslation();

  const {
    userGreetingName,
    totalCustomers,
    totalDebt,
    totalReceived,
    outstandingBalance,
    totalLocations,
    totalItems,
    lowStockCount,
    outOfStockCount,
    isDbConnected,
    recentTransactions,
    recentMovements,
  } = data;

  // Dynamic greeting: "Namaste [Name] Ji 🙏" or fallback "Namaste Ji 🙏"
  const greetingText = userGreetingName
    ? t("greetingNamed", { name: userGreetingName })
    : t("greetingFallback");

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

      {/* TWO PRIMARY MODULE CARDS (LARGE TOUCH-FRIENDLY) */}
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
            <div className="grid grid-cols-2 gap-4 text-left">
              <div>
                <span className="text-[11px] font-bold text-slate-400">{t("totalOutstanding")}</span>
                <div className="text-xl font-black text-red-400">
                  {formatCurrency(outstandingBalance)}
                </div>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400">{t("totalCustomers")}</span>
                <div className="text-xl font-black text-white">
                  {t("registeredCustomers", { count: totalCustomers })}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between text-xs font-bold text-sky-400">
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
            <div className="grid grid-cols-2 gap-4 text-left">
              <div>
                <span className="text-[11px] font-bold text-slate-400">{t("totalCatalogItems")}</span>
                <div className="text-xl font-black text-white">{totalItems} SKUs</div>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400">{t("lowStockAlert")}</span>
                <div className="text-xl font-black text-amber-400">{lowStockCount} Items</div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between text-xs font-bold text-emerald-400">
              <span>{t("manageShopStock")}</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </Link>
      </div>

      {/* DASHBOARD METRIC GRIDS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Billing Overview Section */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-sky-600" />
              <h3 className="text-base font-black text-slate-900">{t("billingKhataSummary")}</h3>
            </div>
            <Link href="/billing" className="text-xs font-bold text-sky-600 hover:underline">
              {t("viewLocationsArrow")}
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500">{t("totalDebtBills")}</span>
              <div className="text-sm font-black text-slate-900 mt-0.5">
                {formatCurrency(totalDebt)}
              </div>
            </div>
            <div className="rounded-2xl bg-emerald-50/60 p-3 border border-emerald-100">
              <span className="text-[11px] font-bold text-emerald-800">{t("paymentsReceived")}</span>
              <div className="text-sm font-black text-emerald-700 mt-0.5">
                {formatCurrency(totalReceived)}
              </div>
            </div>
            <div className="rounded-2xl bg-red-50/70 p-3 border border-red-100">
              <span className="text-[11px] font-bold text-red-800">{t("outstandingBalanceDue")}</span>
              <div className="text-sm font-black text-red-600 mt-0.5">
                {formatCurrency(outstandingBalance)}
              </div>
            </div>
          </div>

          {/* Recent Transactions List */}
          <div className="pt-2">
            <h4 className="text-xs font-bold text-slate-700 mb-2">{t("recentTransactions")}</h4>
            <div className="divide-y divide-slate-100 text-xs">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((tItem) => (
                  <div key={tItem.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">
                        {tItem.customerName} ({tItem.type === "DEBT" ? "Debt" : tItem.paymentMethod || "Payment"})
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {formatDate(tItem.transactionDate, "dd MMM, hh:mm a")} • {t("addedBy")}: {tItem.createdByName}
                      </span>
                    </div>
                    <span
                      className={`font-black ${
                        tItem.type === "DEBT" ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {tItem.type === "DEBT" ? "+" : "-"}{formatCurrency(tItem.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 py-4 text-center">{t("noRecentTransactions")}</p>
              )}
            </div>
          </div>
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

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500">{t("totalCatalogItems")}</span>
              <div className="text-sm font-black text-slate-900 mt-0.5">{totalItems} SKUs</div>
            </div>
            <div className="rounded-2xl bg-amber-50/70 p-3 border border-amber-100">
              <span className="text-[11px] font-bold text-amber-800">{t("lowStockAlert")}</span>
              <div className="text-sm font-black text-amber-900 mt-0.5">{lowStockCount} Items</div>
            </div>
            <div className="rounded-2xl bg-red-50/70 p-3 border border-red-100">
              <span className="text-[11px] font-bold text-red-800">{t("outOfStock")}</span>
              <div className="text-sm font-black text-red-900 mt-0.5">{outOfStockCount} Items</div>
            </div>
          </div>

          {/* Recent Stock Movements List */}
          <div className="pt-2">
            <h4 className="text-xs font-bold text-slate-700 mb-2">{t("recentStockMovements")}</h4>
            <div className="divide-y divide-slate-100 text-xs">
              {recentMovements.length > 0 ? (
                recentMovements.map((m) => (
                  <div key={m.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">
                        {m.itemName} ({m.type === "ADD_STOCK" ? t("stockInflow") : `${t("stockOutflow")}: ${m.removalReason || "Sold"}`})
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {formatDate(m.movementDate, "dd MMM, hh:mm a")} • {t("addedBy")}: {m.createdByName}
                      </span>
                    </div>
                    <span
                      className={`font-black ${
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
          </div>
        </div>
      </div>
    </div>
  );
}
