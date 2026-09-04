"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { ArrowLeft, TrendingUp, TrendingDown, Search, X } from "lucide-react";
import { formatNumber, formatDate } from "@/lib/formatters";
import { useTranslation } from "@/lib/i18n";

export interface MovementData {
  id: string;
  itemName: string;
  itemSku?: string | null;
  unit: string;
  type: string;
  removalReason?: string | null;
  quantity: number;
  previousStock: number;
  newStock: number;
  supplier?: string | null;
  purchasePrice?: number | null;
  notes?: string | null;
  movementDate: string | Date;
  createdByName: string;
}

export function StockHistoryView({ movements }: { movements: MovementData[] }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "ADD_STOCK" | "REMOVE_STOCK">("ALL");

  const filteredMovements = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements.filter((m) => {
      const matchesSearch =
        !q ||
        m.itemName.toLowerCase().includes(q) ||
        (m.itemSku ? m.itemSku.toLowerCase().includes(q) : false);
      const matchesType = filterType === "ALL" || m.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [movements, search, filterType]);

  return (
    <div className="space-y-6 min-w-0">
      {/* Header — mobile compact, desktop unchanged */}
      <div className="md:hidden flex items-center gap-3 min-w-0">
        <Link
          href="/inventory"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-black tracking-tight text-slate-900 truncate">
            {t("movementHistoryTitle")}
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {t("movementHistorySubtitle")}
          </p>
        </div>
      </div>
      <div className="hidden md:flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/inventory"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              {t("movementHistoryTitle")}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("movementHistorySubtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile search + type filter — compact, borderless */}
      <div className="md:hidden space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by item name or SKU"
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-900 focus:outline-none min-h-[44px]"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {[
            ["ALL", "All"],
            ["ADD_STOCK", "ADD"],
            ["REMOVE_STOCK", "REMOVE"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilterType(value as typeof filterType)}
              className={`rounded-lg px-2 py-2 text-xs font-bold transition min-h-[40px] ${filterType === value ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {search || filterType !== "ALL" ? (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">
              {filteredMovements.length} {filteredMovements.length === 1 ? "movement" : "movements"}
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFilterType("ALL");
              }}
              className="font-bold text-slate-600 hover:text-slate-900"
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </div>

      {/* Mobile: vertical movement ledger — clean, borderless, zero horizontal scroll */}
      <div className="md:hidden">
        {filteredMovements.length > 0 ? (
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {filteredMovements.map((m) => {
              const isAdd = m.type === "ADD_STOCK";
              return (
                <div key={m.id} className="py-4 min-w-0">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">{m.itemName}</div>
                    {m.itemSku && (
                      <div className="font-mono text-[11px] text-slate-500 truncate">{m.itemSku}</div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 min-w-0">
                    <span className="break-words">{formatDate(m.movementDate, "dd MMM yyyy \u2022 hh:mm a")}</span>
                    <span className="text-slate-300 shrink-0">•</span>
                    <span className="font-medium text-slate-700 truncate min-w-0">{m.createdByName}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold shrink-0 ${
                        isAdd ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      }`}
                    >
                      {isAdd ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {isAdd ? "ADD" : "REMOVE"}
                    </span>
                    <span className={`text-sm font-black break-words ${isAdd ? "text-emerald-600" : "text-red-600"}`}>
                      {isAdd ? "+" : "-"}
                      {formatNumber(m.quantity, 1)} {m.unit}
                    </span>
                  </div>
                  <div className="mt-2 text-xs min-w-0 flex flex-wrap items-center gap-1">
                    <span className="font-medium text-slate-500">Stock:</span>
                    <span className="font-bold text-slate-600 break-words">{formatNumber(m.previousStock, 1)}</span>
                    <span className="mx-1 text-slate-400">→</span>
                    <span className="font-black text-slate-900 break-words">{formatNumber(m.newStock, 1)}</span>
                    <span className="text-slate-500 break-words">{m.unit}</span>
                  </div>
                  {(m.supplier || m.notes || m.removalReason) && (
                    <div className="mt-2 space-y-1 text-[11px] text-slate-500 min-w-0 break-words">
                      {m.supplier && (
                        <div className="break-words">
                          <span className="font-semibold text-slate-600">Supplier:</span> {m.supplier}
                        </div>
                      )}
                      {!isAdd && m.removalReason && (
                        <div className="break-words">Reason: {m.removalReason}</div>
                      )}
                      {m.notes && <div className="break-words">{m.notes}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center min-w-0">
            <p className="text-sm font-semibold text-slate-600 break-words">{search || filterType !== "ALL" ? "No matching movements" : t("noMovementsRecorded")}</p>
            {search || filterType !== "ALL" ? (
              <p className="mt-1 text-xs text-slate-400 break-words">
                No match for &quot;{search || filterType}&quot;
              </p>
            ) : null}
            {(search || filterType !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFilterType("ALL");
                }}
                className="mt-3 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 min-h-[44px]"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Desktop: table — unchanged */}
      <div className="hidden md:block overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">{t("dateAndTime")}</th>
              <th className="px-6 py-4">{t("itemNameCol")}</th>
              <th className="px-6 py-4">{t("movementTypeCol")}</th>
              <th className="px-6 py-4 text-center">{t("qtyDeltaCol")}</th>
              <th className="px-6 py-4 text-center">{t("stockProgressionCol")}</th>
              <th className="px-6 py-4">{t("reasonSupplierNotesCol")}</th>
              <th className="px-6 py-4 text-right">{t("addedBy")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movements.length > 0 ? (
              movements.map((m) => {
                const isAdd = m.type === "ADD_STOCK";

                return (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      {formatDate(m.movementDate, "dd MMM yyyy, hh:mm a")}
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-extrabold text-sm text-slate-900">{m.itemName}</div>
                      {m.itemSku && (
                        <span className="font-mono text-[11px] text-sky-700 font-semibold">
                          {m.itemSku}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                          isAdd
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-red-50 text-red-800 border border-red-200"
                        }`}
                      >
                        {isAdd ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span>
                          {isAdd
                            ? t("addedStockBadge")
                            : t("removedBadge", { reason: m.removalReason || "Sold" })}
                        </span>
                      </span>
                    </td>

                    <td className={`px-6 py-4 text-center font-black text-sm ${isAdd ? "text-emerald-700" : "text-red-600"}`}>
                      {isAdd ? "+" : "-"}{formatNumber(m.quantity, 1)} {m.unit}
                    </td>

                    <td className="px-6 py-4 text-center font-bold text-slate-800">
                      <span className="text-slate-500">{formatNumber(m.previousStock, 1)}</span>
                      <span className="mx-1.5 text-slate-400">→</span>
                      <span className="font-black text-slate-900">{formatNumber(m.newStock, 1)}</span>
                      <span className="text-[11px] text-slate-500 ml-1">{m.unit}</span>
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {m.supplier && <div className="font-medium text-slate-800">{t("supplierLabel")}: {m.supplier}</div>}
                      {m.notes && <div className="text-[11px] text-slate-500">{m.notes}</div>}
                      {!m.supplier && !m.notes && "-"}
                    </td>

                    <td className="px-6 py-4 text-right font-bold text-slate-900">
                      {m.createdByName}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  {t("noMovementsRecorded")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
