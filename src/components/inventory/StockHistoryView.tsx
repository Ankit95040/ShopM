"use client";

import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
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

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
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
