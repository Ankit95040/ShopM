"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  UserPlus,
  ArrowRight,
  Phone,
  MapPin,
  Building2,
  Calendar,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { createCustomerAction } from "@/server/actions/customer.actions";
import { useTranslation } from "@/lib/i18n";

export interface CustomerData {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
  createdAt: string | Date;
  createdByName: string;
  totalDebt: number;
  totalReceived: number;
  outstandingBalance: number;
  transactionCount: number;
  lastTransactionDate?: string | Date | null;
}

export function CustomerTable({
  initialCustomers,
  locationId,
  locationName,
  userId,
}: {
  initialCustomers: CustomerData[];
  locationId: string;
  locationName: string;
  userId: string;
}) {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState(initialCustomers);
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const totalLocationBalance = customers.reduce((a, b) => a + b.outstandingBalance, 0);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setErrorMsg(null);
    setIsSubmitting(true);
    const res = await createCustomerAction({
      locationId,
      name,
      phone,
      address,
      createdById: userId,
    });
    setIsSubmitting(false);

    if (res.success && res.customer) {
      const created: CustomerData = {
        id: res.customer.id,
        name: res.customer.name,
        phone: res.customer.phone,
        address: res.customer.address,
        createdAt: res.customer.createdAt,
        createdByName: "You",
        totalDebt: 0,
        totalReceived: 0,
        outstandingBalance: 0,
        transactionCount: 0,
      };
      setCustomers([created, ...customers]);
      setIsAddOpen(false);
      setName("");
      setPhone("");
      setAddress("");
    } else {
      setErrorMsg(res.error || "Failed to create customer");
    }
  };

  return (
    <div className="space-y-6">
      {/* Location Breadcrumb & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Link href="/billing" className="hover:underline flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> {t("billingLocationsTitle")}
            </Link>
            <span>/</span>
            <span className="text-slate-900 font-bold">{locationName}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            {t("customersUnderLocation", { locationName })}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t("totalOutstandingKhata")}:{" "}
            <span className="font-extrabold text-red-600">
              {formatCurrency(totalLocationBalance)}
            </span>
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-slate-800 transition active:scale-98"
        >
          <UserPlus className="h-4 w-4 text-sky-400" />
          <span>{t("addNewCustomerBtn")}</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder={t("searchCustomersPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 shadow-xs focus:border-slate-900 focus:outline-none"
        />
      </div>

      {/* Customers Table / Cards */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">{t("customerNameCol")}</th>
              <th className="px-6 py-4 text-right">{t("totalDebtCol")}</th>
              <th className="px-6 py-4 text-right">{t("totalPaidCol")}</th>
              <th className="px-6 py-4 text-right">{t("netBalanceCol")}</th>
              <th className="px-6 py-4 text-center">{t("status")}</th>
              <th className="px-6 py-4 text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length > 0 ? (
              filtered.map((c) => {
                const isAdvance = c.outstandingBalance < 0;
                const isSettled = c.outstandingBalance === 0;

                return (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4">
                      <Link
                        href={`/billing/${locationId}/customers/${c.id}`}
                        className="font-extrabold text-sm text-slate-900 hover:text-sky-600"
                      >
                        {c.name}
                      </Link>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="h-3 w-3" /> {c.phone}
                        </span>
                        {c.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {c.address}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right font-bold text-slate-700">
                      {formatCurrency(c.totalDebt)}
                    </td>

                    <td className="px-6 py-4 text-right font-bold text-emerald-600">
                      {formatCurrency(c.totalReceived)}
                    </td>

                    <td className="px-6 py-4 text-right font-black text-sm">
                      <span className={isAdvance ? "text-emerald-700" : isSettled ? "text-slate-700" : "text-red-600"}>
                        {isAdvance
                          ? `${formatCurrency(Math.abs(c.outstandingBalance))} (Adv)`
                          : formatCurrency(c.outstandingBalance)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          isAdvance
                            ? "bg-emerald-50 text-emerald-700"
                            : isSettled
                            ? "bg-slate-100 text-slate-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {isAdvance ? t("advanceCredit") : isSettled ? "SETTLED" : t("dueBalance")}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/billing/${locationId}/customers/${c.id}`}
                        className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
                      >
                        <span>{t("openLedger")}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  {t("noCustomersFound")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ADD CUSTOMER MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">{t("addNewCustomerModalTitle", { locationName })}</h3>

            {errorMsg && (
              <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{errorMsg}</div>
            )}

            <form onSubmit={handleCreateCustomer} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700">{t("customerNameLabel")} *</label>
                <input
                  type="text"
                  required
                  placeholder={t("customerNamePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t("customerPhoneLabel")} *</label>
                <input
                  type="tel"
                  required
                  placeholder={t("customerPhonePlaceholder")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t("customerAddressLabel")}</label>
                <input
                  type="text"
                  placeholder={t("customerAddressPlaceholder")}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="w-1/3 rounded-xl border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? t("loading") : t("saveCustomerBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
