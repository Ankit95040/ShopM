"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Users,
  ArrowRight,
  Building2,
  Trash2,
  MapPin,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { createLocationAction, softDeleteLocationAction, restoreLocationAction } from "@/server/actions/location.actions";
import { useTranslation } from "@/lib/i18n";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { useToast } from "@/components/shared/ToastContext";
import type { ShopBillingSummary } from "@/server/actions/billing.actions";

export interface LocationData {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string | Date;
  createdByName: string;
  customerCount: number;
  totalDebt: number;
  totalReceived: number;
  outstandingBalance: number;
}

export function LocationCards({
  initialLocations,
  shopBillingSummary,
}: {
  initialLocations: LocationData[];
  shopBillingSummary: ShopBillingSummary;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [locations, setLocations] = useState(initialLocations);
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<LocationData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = locations.filter((loc) =>
    loc.name.toLowerCase().includes(search.toLowerCase())
  );

  const { outstandingBalance: totalAllBalance, totalReceived: totalAllReceived, totalCustomerCount } =
    shopBillingSummary;

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    const res = await createLocationAction({
      name,
      description,
    });
    setIsSubmitting(false);

    if (res.success && res.location) {
      const newLoc: LocationData = {
        id: res.location.id,
        name: res.location.name,
        description: res.location.description,
        createdAt: res.location.createdAt,
        createdByName: "You",
        customerCount: 0,
        totalDebt: 0,
        totalReceived: 0,
        outstandingBalance: 0,
      };
      setLocations([...locations, newLoc]);
      setIsAddModalOpen(false);
      setName("");
      setDescription("");
      toast.success("Location added successfully");
    } else {
      toast.error(res.error || "Failed to create location");
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, loc: LocationData) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget(loc);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const res = await softDeleteLocationAction(deleteTarget.id);
    setIsDeleting(false);

    if (res.success && "archivedCustomerIds" in res) {
      const deletedId = deleteTarget.id;
      setLocations(locations.filter((l) => l.id !== deletedId));
      toast.undo("Location deleted successfully", async () => {
        const restoreRes = await restoreLocationAction(deletedId);
        if (restoreRes.success) {
          window.location.reload();
        }
      });
    } else {
      toast.error("Failed to delete location");
    }
    setDeleteTarget(null);
  };

  const isEmpty = locations.length === 0;
  const noResults = !isEmpty && filtered.length === 0;

  return (
    <div className="space-y-5 min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 break-words">
            {t("billingLocationsTitle")}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 break-words">
            {t("billingLocationsSubtitle")}
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 self-stretch sm:self-start rounded-xl bg-slate-900 px-4 py-3 sm:py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 active:scale-[0.98] min-h-[44px]"
        >
          <Plus className="h-4 w-4 shrink-0 text-sky-400" />
          <span>{t("addLocationBtn")}</span>
        </button>
      </div>

      {/* Summary Cards — desktop only */}
      <div className="hidden sm:grid grid-cols-3 gap-3 min-w-0">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs min-w-0 overflow-hidden">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("totalOutstanding")}</span>
          <div className="mt-1 text-xl font-black text-red-600 sm:text-2xl whitespace-nowrap">
            {formatCurrency(totalAllBalance)}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400 break-words">Across all locations</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs min-w-0 overflow-hidden">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("paymentsReceived")}</span>
          <div className="mt-1 text-xl font-black text-emerald-600 sm:text-2xl whitespace-nowrap">
            {formatCurrency(totalAllReceived)}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400 break-words">Collected from customers</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs min-w-0 overflow-hidden">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("totalCustomers")}</span>
          <div className="mt-1 text-xl font-black text-slate-900 sm:text-2xl break-words">
            {t("registeredCustomers", { count: totalCustomerCount })}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400 break-words">
            {locations.length} Location{locations.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Locations Section */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Your Locations
          </h2>

          {!isEmpty && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={t("searchLocationsPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 shadow-xs transition focus:border-slate-900 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Empty State */}
        {isEmpty && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <MapPin className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="mt-4 text-sm font-bold text-slate-900">No locations yet</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
              Add your first shop location or branch to start managing customers and billing.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 text-sky-400" />
              {t("addLocationBtn")}
            </button>
          </div>
        )}

        {/* No Search Results */}
        {noResults && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <Search className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-600">No locations match &ldquo;{search}&rdquo;</p>
            <p className="mt-1 text-xs text-slate-400">Try a different search term.</p>
          </div>
        )}

        {/* Location Cards */}
        {!isEmpty && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((loc) => (
              <Link
                key={loc.id}
                href={`/billing/${loc.id}`}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-900 hover:shadow-md active:scale-[0.99]"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 transition group-hover:bg-slate-900 group-hover:text-white">
                      <Building2 className="h-5 w-5" />
                    </div>

                    <button
                      onClick={(e) => handleDeleteClick(e, loc)}
                      title="Delete Location"
                      className="inline-flex h-11 w-11 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-600 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <h3 className="mt-3 text-base font-black text-slate-900 transition group-hover:text-sky-600 break-words min-w-0">
                    {loc.name}
                  </h3>
                  {loc.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500 break-words">{loc.description}</p>
                  )}

                  {/* Mobile: small secondary customer count */}
                  <div className="sm:hidden mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>{loc.customerCount} {loc.customerCount === 1 ? "registered customer" : "registered customers"}</span>
                  </div>
                  {/* Desktop: pill style */}
                  <div className="hidden sm:inline-flex mt-3 items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 max-w-full break-words">
                    <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="break-words">{t("registeredCustomers", { count: loc.customerCount })}</span>
                  </div>
                </div>

                {/* Desktop footer with balance — hidden on mobile */}
                <div className="hidden sm:block mt-4 border-t border-slate-100 pt-3 min-w-0">
                  <div className="flex items-center justify-between text-xs gap-2 min-w-0">
                    <span className="text-slate-500 shrink-0">{t("balanceDue")}:</span>
                    <span className="text-base font-black text-red-600 whitespace-nowrap text-right min-w-0">
                      {formatCurrency(loc.outstandingBalance)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 gap-2 min-w-0">
                    <span className="truncate min-w-0">{t("addedBy")}: {loc.createdByName}</span>
                    <span className="flex items-center gap-1 font-bold text-sky-600 transition group-hover:translate-x-0.5 shrink-0 whitespace-nowrap">
                      {t("openCustomers")} <ArrowRight className="h-3 w-3 shrink-0" />
                    </span>
                  </div>
                </div>
                {/* Mobile footer — only Open action, compact */}
                <div className="sm:hidden mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400 truncate">{t("addedBy")}: {loc.createdByName}</span>
                  <span className="flex items-center gap-1 text-xs font-bold text-sky-600 shrink-0 whitespace-nowrap">
                    Open Location <ArrowRight className="h-3 w-3 shrink-0" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* DELETE LOCATION CONFIRM MODAL */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Location?"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? Customers and financial history will be preserved and hidden from active views. You can restore from the Recycle Bin within 30 days.`
            : ""
        }
        confirmLabel="Delete Location"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeleting}
      />

      {/* ADD LOCATION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900">{t("createLocationTitle")}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {t("createLocationSubtitle")}
            </p>

            <form onSubmit={handleCreateLocation} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700">{t("locationNameLabel")} *</label>
                <input
                  type="text"
                  required
                  placeholder={t("locationNamePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t("locationAddressLabel")}</label>
                <textarea
                  rows={2}
                  placeholder={t("locationAddressPlaceholder")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-1/3 rounded-xl border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? t("loading") : t("saveLocationBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}