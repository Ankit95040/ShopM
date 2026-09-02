"use client";

import { useState, useMemo, useRef } from "react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useTranslation } from "@/lib/i18n";
import { PeriodReport } from "@/lib/accounting";
import { ReportCustomer, ReportTransaction } from "@/server/actions/report.actions";
import { getBillImageSignedUrl } from "@/server/actions/upload.actions";
import { ImageViewer } from "@/components/shared/ImageViewer";
import { useToast } from "@/components/shared/ToastContext";
import { FileText, Search, X, Calendar, Filter } from "lucide-react";

export interface ReportsViewProps {
  periodReport: PeriodReport;
  customers: ReportCustomer[];
  transactions: ReportTransaction[];
  availableMonths: Array<{ key: string; label: string }>;
  selectedMonth: string;
  selectedCustomerId: string;
  onMonthChange: (month: string) => void;
  onCustomerChange: (customerId: string) => void;
  isLoading?: boolean;
}

export function ReportsView({
  periodReport,
  customers,
  transactions,
  availableMonths,
  selectedMonth,
  selectedCustomerId,
  onMonthChange,
  onCustomerChange,
  isLoading = false,
}: ReportsViewProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"summary" | "transactions">("summary");
  const [selectedImageView, setSelectedImageView] = useState<string | null>(null);

  // Customer search state
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const searchLower = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.phone.toLowerCase().includes(searchLower)
    );
  }, [customers, customerSearch]);

  const selectedCustomerName = useMemo(() => {
    if (selectedCustomerId === "all") return "";
    const cust = customers.find((c) => c.id === selectedCustomerId);
    return cust ? cust.name : "";
  }, [customers, selectedCustomerId]);

  const hasActiveFilters = selectedMonth !== "all" || selectedCustomerId !== "all";

  const handleCustomerSelect = (customerId: string) => {
    onCustomerChange(customerId);
    setIsCustomerDropdownOpen(false);
    setCustomerSearch("");
  };

  const handleClearFilters = () => {
    onMonthChange("all");
    onCustomerChange("all");
    setCustomerSearch("");
  };

  const handleViewBillImage = async (tx: ReportTransaction) => {
    const res = await getBillImageSignedUrl({
      transactionId: tx.id,
      customerId: tx.customerIdForImage || tx.customerId,
    });
    if (res.success && res.url) {
      setSelectedImageView(res.url);
    } else {
      toast.error(res.error || "Failed to load bill image");
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight sm:text-2xl">
            {t("reportsTitle")}
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {t("reportsSubtitleCompact")}
          </p>
        </div>
      </div>

      {/* Compact Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Month Filter */}
          <div className="relative sm:w-48">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-xs font-bold text-slate-900 focus:border-slate-400 focus:outline-none min-h-[44px] appearance-none"
            >
              <option value="all">{t("allTime")}</option>
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Customer Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              ref={customerInputRef}
              type="text"
              value={isCustomerDropdownOpen ? customerSearch : selectedCustomerName || customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setIsCustomerDropdownOpen(true);
              }}
              onFocus={() => {
                setIsCustomerDropdownOpen(true);
                setCustomerSearch("");
              }}
              placeholder={t("searchCustomerPlaceholder")}
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 py-2.5 text-xs font-bold text-slate-900 focus:border-slate-400 focus:outline-none min-h-[44px]"
            />
            {(customerSearch || selectedCustomerId !== "all") && (
              <button
                onClick={() => {
                  setCustomerSearch("");
                  if (selectedCustomerId !== "all") {
                    onCustomerChange("all");
                  }
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition"
              >
                <X className="h-3 w-3" />
              </button>
            )}

            {/* Customer Dropdown */}
            {isCustomerDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                <button
                  onClick={() => handleCustomerSelect("all")}
                  className={`w-full px-3 py-2.5 text-left text-xs font-bold transition ${
                    selectedCustomerId === "all"
                      ? "bg-sky-50 text-sky-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t("allCustomers")}
                </button>
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleCustomerSelect(c.id)}
                      className={`w-full px-3 py-2.5 text-left text-xs transition border-t border-slate-100 ${
                        selectedCustomerId === c.id
                          ? "bg-sky-50 text-sky-700"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="font-bold">{c.name}</div>
                      <div className="text-[10px] text-slate-400">{c.locationName}</div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-3 text-center text-[11px] text-slate-400">
                    {t("noCustomersFound")}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="sm:w-auto rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition min-h-[44px] whitespace-nowrap"
            >
              {t("clearFilters")}
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setActiveTab("summary")}
          className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition min-h-[44px] ${
            activeTab === "summary"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {t("financialSummary")}
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition min-h-[44px] ${
            activeTab === "transactions"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {t("transactionHistory")}
        </button>
      </div>

      {isLoading && (
        <div className="text-center py-8 text-slate-400 text-xs">{t("loading")}</div>
      )}

      {/* Financial Summary Tab */}
      {activeTab === "summary" && !isLoading && (
        <div className="space-y-4">
          {/* Billing Summary Cards */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <h3 className="text-xs font-black text-slate-900 mb-3 uppercase tracking-wider">{t("billingSummary")}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t("openingBalance")}</span>
                <div className="mt-1 text-base font-black text-slate-900">
                  {formatCurrency(periodReport.openingBalance)}
                </div>
              </div>
              <div className="rounded-xl bg-red-50/70 p-3 border border-red-100">
                <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">{t("billsInPeriod")}</span>
                <div className="mt-1 text-base font-black text-red-600">
                  {formatCurrency(periodReport.billsInPeriod)}
                </div>
                <p className="text-[10px] text-red-400 mt-0.5">{periodReport.billCount} {t("billsLabel")}</p>
              </div>
              <div className="rounded-xl bg-emerald-50/60 p-3 border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">{t("paymentsInPeriod")}</span>
                <div className="mt-1 text-base font-black text-emerald-600">
                  {formatCurrency(periodReport.paymentsInPeriod)}
                </div>
                <p className="text-[10px] text-emerald-400 mt-0.5">{periodReport.paymentCount} {t("paymentsLabel")}</p>
              </div>
              <div className={`rounded-xl p-3 border-2 ${
                periodReport.closingBalance < 0
                  ? "bg-emerald-50 border-emerald-300"
                  : periodReport.closingBalance > 0
                    ? "bg-red-50 border-red-300"
                    : "bg-slate-50 border-slate-200"
              }`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  periodReport.closingBalance < 0 ? "text-emerald-700" : periodReport.closingBalance > 0 ? "text-red-700" : "text-slate-500"
                }`}>
                  {periodReport.closingBalance < 0 ? t("advanceCreditBalance") : t("closingOutstanding")}
                </span>
                <div className={`mt-1 text-lg font-black ${
                  periodReport.closingBalance < 0 ? "text-emerald-700" : periodReport.closingBalance > 0 ? "text-red-600" : "text-slate-900"
                }`}>
                  {formatCurrency(Math.abs(periodReport.closingBalance))}
                </div>
              </div>
            </div>
          </div>

          {/* Customer Outstanding Summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">{t("customerOutstandingSummary")}</h3>
              <span className="text-[10px] font-bold text-slate-400">{t("customersCount", { count: customers.length })}</span>
            </div>

            {/* Desktop: Table */}
            <div className="hidden sm:block">
              {customers.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 font-bold text-slate-500">{t("customerNameCol")}</th>
                      <th className="text-left py-2 font-bold text-slate-500">{t("locationShopCol")}</th>
                      <th className="text-right py-2 font-bold text-slate-500">{t("totalDebtReportCol")}</th>
                      <th className="text-right py-2 font-bold text-slate-500">{t("totalPaymentsReportCol")}</th>
                      <th className="text-right py-2 font-bold text-slate-500">{t("netOutstandingCol")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {customers.map((cust) => (
                      <tr key={cust.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-2.5 font-bold text-slate-900">{cust.name}</td>
                        <td className="py-2.5 text-slate-500">{cust.locationName}</td>
                        <td className="py-2.5 text-right font-bold text-slate-700">
                          {formatCurrency(cust.totalDebt)}
                        </td>
                        <td className="py-2.5 text-right font-bold text-emerald-600">
                          {formatCurrency(cust.totalReceived)}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className={`font-black ${cust.outstandingBalance < 0 ? "text-emerald-600" : cust.outstandingBalance > 0 ? "text-red-600" : "text-slate-900"}`}>
                            {formatCurrency(Math.abs(cust.outstandingBalance))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  {t("noCustomersFound")}
                </div>
              )}
            </div>

            {/* Mobile: Cards */}
            <div className="sm:hidden space-y-2">
              {customers.length > 0 ? (
                customers.map((cust) => (
                  <div key={cust.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 truncate">{cust.name}</div>
                        <div className="text-[10px] text-slate-400">{cust.locationName}</div>
                      </div>
                      <span className={`text-sm font-black shrink-0 ${cust.outstandingBalance < 0 ? "text-emerald-600" : cust.outstandingBalance > 0 ? "text-red-600" : "text-slate-900"}`}>
                        {formatCurrency(Math.abs(cust.outstandingBalance))}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span>{t("billsLabel")}: <strong className="text-slate-700">{formatCurrency(cust.totalDebt)}</strong></span>
                      <span>{t("paymentsLabel")}: <strong className="text-emerald-600">{formatCurrency(cust.totalReceived)}</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  {t("noCustomersFound")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transaction History Tab */}
      {activeTab === "transactions" && !isLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">{t("allTransactions")}</h3>
            <span className="text-[10px] font-bold text-slate-400">{t("transactionsCount", { count: transactions.length })}</span>
          </div>

          {/* Desktop: Table */}
          <div className="hidden sm:block">
            {transactions.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 font-bold text-slate-500">{t("dateAndTime")}</th>
                    <th className="text-left py-2 font-bold text-slate-500">{t("customerNameCol")}</th>
                    <th className="text-left py-2 font-bold text-slate-500 hidden md:table-cell">{t("locationShopCol")}</th>
                    <th className="text-center py-2 font-bold text-slate-500">{t("typeLabel")}</th>
                    <th className="text-right py-2 font-bold text-slate-500">{t("amountLabel")}</th>
                    <th className="text-left py-2 font-bold text-slate-500 hidden lg:table-cell">{t("detailsLabel")}</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-2.5 text-slate-600 whitespace-nowrap">
                        {formatDate(tx.transactionDate, "dd MMM, hh:mm a")}
                      </td>
                      <td className="py-2.5">
                        <div className="font-bold text-slate-900">{tx.customerName}</div>
                      </td>
                      <td className="py-2.5 text-slate-500 hidden md:table-cell">{tx.locationName}</td>
                      <td className="py-2.5 text-center">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          tx.type === "DEBT"
                            ? "bg-red-100 text-red-600"
                            : "bg-emerald-100 text-emerald-600"
                        }`}>
                          {tx.type === "DEBT" ? t("billLabel") : t("paymentLabel")}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={`font-black ${
                          tx.type === "DEBT" ? "text-red-600" : "text-emerald-600"
                        }`}>
                          {tx.type === "DEBT" ? "+" : "-"}{formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-500 text-[11px] hidden lg:table-cell">
                        {tx.billNumber || tx.paymentMethod || tx.description || "-"}
                      </td>
                      <td className="py-2.5">
                        {tx.billImageKey && (
                          <button
                            onClick={() => handleViewBillImage(tx)}
                            className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition"
                            title={t("viewBillImage")}
                            aria-label={t("viewBillImage")}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                {t("noTransactionsFound")}
              </div>
            )}
          </div>

          {/* Mobile: Cards */}
          <div className="sm:hidden space-y-2">
            {transactions.length > 0 ? (
              transactions.map((tx) => (
                <div key={tx.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 truncate">{tx.customerName}</div>
                      <div className="text-[10px] text-slate-400">
                        {formatDate(tx.transactionDate, "dd MMM yyyy \u2022 h:mm a")}
                      </div>
                    </div>
                    <span className={`text-sm font-black shrink-0 ${tx.type === "DEBT" ? "text-red-600" : "text-emerald-600"}`}>
                      {tx.type === "DEBT" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      tx.type === "DEBT"
                        ? "bg-red-100 text-red-600"
                        : "bg-emerald-100 text-emerald-600"
                    }`}>
                      {tx.type === "DEBT" ? t("billLabel") : t("paymentLabel")}
                    </span>
                    {tx.billImageKey && (
                      <button
                        onClick={() => handleViewBillImage(tx)}
                        className="flex min-h-[44px] items-center gap-1 rounded-lg bg-sky-50 px-2.5 text-[10px] font-bold text-sky-600 hover:bg-sky-100 transition"
                        title={t("viewBillImage")}
                        aria-label={t("viewBillImage")}
                      >
                        <FileText className="h-3 w-3" />
                        {t("viewBillImage")}
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                {t("noTransactionsFound")}
              </div>
            )}
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

      {/* Click outside to close customer dropdown */}
      {isCustomerDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsCustomerDropdownOpen(false)}
        />
      )}
    </div>
  );
}
