"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  UserPlus,
  ArrowRight,
  Phone,
  MapPin,
  Building2,
  Trash2,
  Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { createCustomerAction, softDeleteCustomerAction, restoreCustomerAction } from "@/server/actions/customer.actions";
import { useTranslation } from "@/lib/i18n";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { useToast } from "@/components/shared/ToastContext";

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
}: {
  initialCustomers: CustomerData[];
  locationId: string;
  locationName: string;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [customers, setCustomers] = useState(initialCustomers);
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CustomerData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const totalLocationBalance = customers.reduce((a, b) => a + b.outstandingBalance, 0);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setIsSubmitting(true);
    const res = await createCustomerAction({
      locationId,
      name,
      phone,
      address,
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
      toast.success("Customer added successfully");
    } else {
      toast.error(res.error || "Failed to create customer");
    }
  };

  const handleDeleteClick = (c: CustomerData) => {
    setDeleteTarget(c);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const res = await softDeleteCustomerAction(deleteTarget.id);
    setIsDeleting(false);

    if (res.success) {
      const deletedId = deleteTarget.id;
      setCustomers(customers.filter((c) => c.id !== deletedId));
      toast.undo("Customer deleted successfully", async () => {
        const restoreRes = await restoreCustomerAction(deletedId);
        if (restoreRes.success) {
          window.location.reload();
        }
      });
    } else {
      toast.error("Failed to delete customer");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <p className="mt-0.5 text-xs text-slate-500 break-words">
            {t("totalOutstandingKhata")}:{" "}
            <span className="font-extrabold text-red-600 whitespace-nowrap">
              {formatCurrency(totalLocationBalance)}
            </span>
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 active:scale-[0.98]"
        >
          <UserPlus className="h-4 w-4 text-sky-400" />
          <span>{t("addNewCustomerBtn")}</span>
        </button>
      </div>

      {/* Customers Section */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Customers
          </h2>

          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t("searchCustomersPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 shadow-xs transition focus:border-slate-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Mobile: Customer Cards (≤768px) — replaces table to avoid horizontal page scroll */}
        <div className="md:hidden space-y-3">
          {filtered.length > 0 ? (
            filtered.map((c) => {
              const isAdvance = c.outstandingBalance < 0;
              const isSettled = c.outstandingBalance === 0;
              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs min-w-0 overflow-hidden"
                >
                  {/* Top: name + status */}
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <Link
                      href={`/billing/${locationId}/customers/${c.id}`}
                      className="min-w-0 flex-1 font-extrabold text-[15px] leading-tight text-slate-900 hover:text-sky-600 break-words"
                    >
                      {c.name}
                    </Link>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold leading-none whitespace-nowrap ${
                        isAdvance
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : isSettled
                          ? "bg-slate-100 text-slate-700 border border-slate-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {isAdvance ? t("advanceCredit") : isSettled ? "SETTLED" : t("dueBalance")}
                    </span>
                  </div>

                  {/* Phone / Address */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 min-w-0">
                    <span className="inline-flex items-center gap-1 min-w-0 font-mono break-all">
                      <Phone className="h-3 w-3 shrink-0 text-slate-400" /> {c.phone}
                    </span>
                    {c.address && (
                      <span className="inline-flex items-center gap-1 min-w-0 break-words">
                        <MapPin className="h-3 w-3 shrink-0 text-slate-400" /> <span className="break-words">{c.address}</span>
                      </span>
                    )}
                  </div>

                  {/* Financial summary — stacked, no horizontal overflow */}
                  <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-50 border border-slate-100 p-2 min-w-0">
                    <div className="min-w-0 text-center">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">Debt</div>
                      <div className="mt-0.5 text-[11px] min-[360px]:text-xs font-black text-slate-700 whitespace-nowrap">{formatCurrency(c.totalDebt)}</div>
                    </div>
                    <div className="min-w-0 text-center border-x border-slate-200 px-1">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">Paid</div>
                      <div className="mt-0.5 text-[11px] min-[360px]:text-xs font-black text-emerald-600 whitespace-nowrap">{formatCurrency(c.totalReceived)}</div>
                    </div>
                    <div className="min-w-0 text-center">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">Balance</div>
                      <div className={`mt-0.5 text-[11px] min-[360px]:text-xs font-black whitespace-nowrap ${isAdvance ? "text-emerald-700" : isSettled ? "text-slate-700" : "text-red-600"}`}>
                        {isAdvance ? `${formatCurrency(Math.abs(c.outstandingBalance))}` : formatCurrency(c.outstandingBalance)}
                      </div>
                    </div>
                  </div>

                  {/* Actions — 44px touch targets, comfortable spacing */}
                  <div className="mt-3 flex items-center gap-2 min-w-0">
                    <Link
                      href={`/billing/${locationId}/customers/${c.id}`}
                      className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-xs hover:bg-slate-800 transition min-w-0"
                    >
                      <span className="truncate">{t("openLedger")}</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </Link>
                    <button
                      onClick={() => handleDeleteClick(c)}
                      aria-label="Delete customer"
                      className="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                <Users className="h-6 w-6 text-slate-400" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-600 break-words">{search ? `No customers match "${search}"` : "No customers yet"}</p>
              <p className="mt-1 text-xs text-slate-400 break-words">{search ? "Try a different search term." : "Add your first customer to start managing khata balances."}</p>
            </div>
          )}
        </div>

        {/* Desktop: Customer Table (≥768px) — unchanged */}
        <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">{t("customerNameCol")}</th>
                  <th className="px-5 py-3.5 text-right">{t("totalDebtCol")}</th>
                  <th className="px-5 py-3.5 text-right">{t("totalPaidCol")}</th>
                  <th className="px-5 py-3.5 text-right">{t("netBalanceCol")}</th>
                  <th className="px-5 py-3.5 text-center">{t("status")}</th>
                  <th className="px-5 py-3.5 text-right">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length > 0 ? (
                  filtered.map((c) => {
                    const isAdvance = c.outstandingBalance < 0;
                    const isSettled = c.outstandingBalance === 0;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/billing/${locationId}/customers/${c.id}`}
                            className="font-extrabold text-sm text-slate-900 hover:text-sky-600"
                          >
                            {c.name}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500">
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

                        <td className="px-5 py-3.5 text-right font-bold text-slate-700 whitespace-nowrap">
                          {formatCurrency(c.totalDebt)}
                        </td>

                        <td className="px-5 py-3.5 text-right font-bold text-emerald-600 whitespace-nowrap">
                          {formatCurrency(c.totalReceived)}
                        </td>

                        <td className="px-5 py-3.5 text-right font-black text-sm whitespace-nowrap">
                          <span className={isAdvance ? "text-emerald-700" : isSettled ? "text-slate-700" : "text-red-600"}>
                            {isAdvance
                              ? `${formatCurrency(Math.abs(c.outstandingBalance))} (Adv)`
                              : formatCurrency(c.outstandingBalance)}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-center">
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

                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/billing/${locationId}/customers/${c.id}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
                            >
                              <span>{t("openLedger")}</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                            <button
                              onClick={() => handleDeleteClick(c)}
                              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                              title="Delete Customer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                        <Users className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-600">
                        {search ? `No customers match "${search}"` : "No customers yet"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400 max-w-xs mx-auto">
                        {search
                          ? "Try a different search term."
                          : "Add your first customer to start managing khata balances."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DELETE CUSTOMER CONFIRM MODAL */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Customer?"
        description={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.name}? Their account and financial history will be moved to the Recycle Bin. You can restore within 30 days.`
            : ""
        }
        confirmLabel="Delete Customer"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeleting}
      />

      {/* ADD CUSTOMER MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900">{t("addNewCustomerModalTitle", { locationName })}</h3>

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
