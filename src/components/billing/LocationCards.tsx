"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Plus,
  Search,
  Users,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Building2,
  Trash2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { createLocationAction, softDeleteLocationAction } from "@/server/actions/location.actions";
import { useTranslation } from "@/lib/i18n";

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
  userId,
}: {
  initialLocations: LocationData[];
  userId: string;
}) {
  const { t } = useTranslation();
  const [locations, setLocations] = useState(initialLocations);
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filtered = locations.filter((loc) =>
    loc.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalAllDebt = locations.reduce((a, b) => a + b.totalDebt, 0);
  const totalAllReceived = locations.reduce((a, b) => a + b.totalReceived, 0);
  const totalAllBalance = totalAllDebt - totalAllReceived;

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setErrorMsg(null);
    setIsSubmitting(true);
    const res = await createLocationAction({
      name,
      description,
      createdById: userId,
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
    } else {
      setErrorMsg(res.error || "Failed to create location");
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this location?")) return;

    const res = await softDeleteLocationAction(id);
    if (res.success) {
      setLocations(locations.filter((l) => l.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title & Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            {t("billingLocationsTitle")}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t("billingLocationsSubtitle")}
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-slate-800 transition active:scale-98"
        >
          <Plus className="h-4 w-4 text-sky-400" />
          <span>{t("addLocationBtn")}</span>
        </button>
      </div>

      {/* Aggregate Balance Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">{t("totalOutstanding")}</span>
          <div className="mt-1 text-2xl font-black text-red-600">
            {formatCurrency(totalAllBalance)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Across all shop locations</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">{t("paymentsReceived")}</span>
          <div className="mt-1 text-2xl font-black text-emerald-600">
            {formatCurrency(totalAllReceived)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Collected from customers</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">{t("totalCustomers")}</span>
          <div className="mt-1 text-2xl font-black text-slate-900">
            {t("registeredCustomers", { count: locations.reduce((a, b) => a + b.customerCount, 0) })}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {locations.length} Locations / Outlets
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder={t("searchLocationsPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 shadow-xs focus:border-slate-900 focus:outline-none"
        />
      </div>

      {/* Locations Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((loc) => (
          <Link
            key={loc.id}
            href={`/billing/${loc.id}`}
            className="group relative flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-xs transition hover:border-slate-900 hover:shadow-md active:scale-99"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 group-hover:bg-slate-900 group-hover:text-white transition">
                  <Building2 className="h-6 w-6" />
                </div>

                <button
                  onClick={(e) => handleDelete(e, loc.id)}
                  title="Delete Location"
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <h3 className="mt-4 text-lg font-black text-slate-900 group-hover:text-sky-600 transition">
                {loc.name}
              </h3>
              {loc.description && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{loc.description}</p>
              )}

              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <Users className="h-4 w-4 text-slate-400" />
                <span>{t("registeredCustomers", { count: loc.customerCount })}</span>
              </div>
            </div>

            {/* Financial summary on card */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{t("balanceDue")}:</span>
                <span className="text-base font-black text-red-600">
                  {formatCurrency(loc.outstandingBalance)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>{t("addedBy")}: {loc.createdByName}</span>
                <span className="flex items-center gap-1 font-bold text-sky-600 group-hover:translate-x-0.5 transition">
                  {t("openCustomers")} <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ADD LOCATION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">{t("createLocationTitle")}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("createLocationSubtitle")}
            </p>

            {errorMsg && (
              <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{errorMsg}</div>
            )}

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
