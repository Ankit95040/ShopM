"use client";

import { formatCurrency, formatDate } from "@/lib/formatters";
import { BarChart3, TrendingUp, CreditCard, Building2, Boxes } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export interface LocationReportItem {
  id: string;
  name: string;
  customerCount: number;
  debt: number;
  received: number;
  balance: number;
}

export interface InventoryReportItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  purchasePrice?: number | null;
  categoryName: string;
}

export function ReportsView({
  locationReport,
  items,
  totalValuation,
}: {
  locationReport: LocationReportItem[];
  items: InventoryReportItem[];
  totalValuation: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
          {t("reportsTitle")}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {t("reportsSubtitle")}
        </p>
      </div>

      {/* Location-wise Outstanding Balances */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Building2 className="h-5 w-5 text-sky-600" />
          <h2 className="text-base font-bold text-slate-900">{t("locationFinancialBreakdown")}</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">{t("locationShopCol")}</th>
                <th className="px-6 py-3.5 text-center">{t("customersCountCol")}</th>
                <th className="px-6 py-3.5 text-right">{t("totalDebtReportCol")}</th>
                <th className="px-6 py-3.5 text-right">{t("totalPaymentsReportCol")}</th>
                <th className="px-6 py-3.5 text-right">{t("netOutstandingCol")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {locationReport.map((loc) => (
                <tr key={loc.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-6 py-3.5 font-bold text-slate-900">{loc.name}</td>
                  <td className="px-6 py-3.5 text-center text-slate-600">{loc.customerCount}</td>
                  <td className="px-6 py-3.5 text-right font-bold text-slate-700">
                    {formatCurrency(loc.debt)}
                  </td>
                  <td className="px-6 py-3.5 text-right font-bold text-emerald-600">
                    {formatCurrency(loc.received)}
                  </td>
                  <td className="px-6 py-3.5 text-right font-black text-red-600">
                    {formatCurrency(loc.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Valuation by Category */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">{t("inventoryStockValuationTitle")}</h2>
          </div>
          <span className="text-xs font-bold text-slate-900">
            {t("totalAssetValue")}: <strong className="text-emerald-700">{formatCurrency(totalValuation)}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">{t("categoryCol")}</th>
                <th className="px-6 py-3.5">{t("itemNameLabel")}</th>
                <th className="px-6 py-3.5 text-center">{t("currentStockCol")}</th>
                <th className="px-6 py-3.5 text-right">{t("costPriceCol")}</th>
                <th className="px-6 py-3.5 text-right">{t("totalValuationCol")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => {
                const stock = Number(i.currentStock);
                const cost = Number(i.purchasePrice) || 0;
                const value = stock * cost;

                return (
                  <tr key={i.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3.5 text-slate-500 font-medium">{i.categoryName}</td>
                    <td className="px-6 py-3.5 font-bold text-slate-900">{i.name}</td>
                    <td className="px-6 py-3.5 text-center font-bold text-slate-800">
                      {stock} {i.unit}
                    </td>
                    <td className="px-6 py-3.5 text-right text-slate-600">
                      {cost > 0 ? formatCurrency(cost) : "-"}
                    </td>
                    <td className="px-6 py-3.5 text-right font-black text-slate-900">
                      {formatCurrency(value)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
