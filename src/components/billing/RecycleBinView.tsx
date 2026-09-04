"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, RotateCcw, Building2, Phone, Clock, Package, Boxes } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { restoreCustomerAction } from "@/server/actions/customer.actions";
import { restoreInventoryItemAction } from "@/server/actions/inventory.actions";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/shared/ToastContext";

export interface DeletedCustomer {
  id: string;
  name: string;
  phone: string;
  locationName: string;
  deletedAt: Date | string;
  expiresAt: Date | string;
  daysRemaining: number;
}

export interface DeletedInventoryItem {
  id: string;
  name: string;
  categoryName: string;
  unit: string;
  deletedAt: Date | string;
  expiresAt: Date | string;
  daysRemaining: number;
}

export function RecycleBinView({
  initialCustomers,
  initialInventoryItems = [],
}: {
  initialCustomers: DeletedCustomer[];
  initialInventoryItems?: DeletedInventoryItem[];
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [customers, setCustomers] = useState(initialCustomers);
  const [inventoryItems, setInventoryItems] = useState<DeletedInventoryItem[]>(initialInventoryItems);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleRestore = async (customer: DeletedCustomer) => {
    setRestoringId(customer.id);
    const res = await restoreCustomerAction(customer.id);
    setRestoringId(null);

    if (res.success) {
      setCustomers(customers.filter((c) => c.id !== customer.id));
      toast.success(`Customer "${customer.name}" restored successfully`);
    } else {
      toast.error(res.error || "Failed to restore customer");
    }
  };

  const handleRestoreInventory = async (item: DeletedInventoryItem) => {
    setRestoringId(item.id);
    const res = await restoreInventoryItemAction(item.id);
    setRestoringId(null);
    if (res.success) {
      setInventoryItems(inventoryItems.filter((i) => i.id !== item.id));
      toast.success(`Item "${item.name}" restored successfully`);
    } else {
      toast.error(res.error || "Failed to restore item");
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Link href="/billing" className="hover:underline flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> {t("billingLocationsTitle")}
            </Link>
            <span>/</span>
            <span className="text-slate-900 font-bold">Recycle Bin</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Recycle Bin
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Deleted customers are recoverable for 30 days. After that, they are permanently removed.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 border border-amber-200">
          <Clock className="h-4 w-4 text-amber-600" />
          <span>{customers.length} deleted customer(s)</span>
        </div>
      </div>

      {/* Mobile: Recycle Bin cards */}
      <div className="md:hidden space-y-3">
        {customers.length === 0 && inventoryItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <Trash2 className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-600">Recycle bin is empty</p>
            <p className="text-[11px] mt-1 text-slate-400">Deleted customers and items will appear here for 30 days.</p>
          </div>
        ) : (
          <>
            {customers.map((c) => (
              <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-sm text-slate-900 truncate">{c.name}</div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 font-mono truncate"><Phone className="h-3 w-3 shrink-0" /> {c.phone}</div>
                    <div className="text-xs text-slate-600 mt-1 truncate">{c.locationName}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Deleted {formatDate(c.deletedAt, "dd MMM")}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.daysRemaining <=7?"bg-red-100 text-red-800":c.daysRemaining<=14?"bg-amber-100 text-amber-800":"bg-emerald-100 text-emerald-800"}`}>{c.daysRemaining} days left</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => handleRestore(c)} disabled={restoringId===c.id} className="mt-3 w-full inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 transition">
                  <RotateCcw className="h-4 w-4" /> {restoringId===c.id?"Restoring...":"Restore"}
                </button>
              </div>
            ))}
            {inventoryItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><Package className="h-4 w-4 text-slate-500 shrink-0" /><span className="font-extrabold text-sm text-slate-900 truncate">{item.name}</span></div>
                    <div className="text-xs text-slate-600 mt-0.5 truncate">{item.categoryName} • {item.unit}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Deleted {formatDate(item.deletedAt, "dd MMM")}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.daysRemaining <=7?"bg-red-100 text-red-800":item.daysRemaining<=14?"bg-amber-100 text-amber-800":"bg-emerald-100 text-emerald-800"}`}>{item.daysRemaining} days left</span>
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600"><Boxes className="h-3 w-3" /> Item</span>
                </div>
                <button onClick={() => handleRestoreInventory(item)} disabled={restoringId===item.id} className="mt-3 w-full inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 transition">
                  <RotateCcw className="h-4 w-4" /> {restoringId===item.id?"Restoring...":"Restore"}
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Desktop: Table (locked) */}
      <div className="hidden md:block overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Deleted</th>
              <th className="px-6 py-4">Expires</th>
              <th className="px-6 py-4 text-center">Days Left</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.length > 0 ? (
              customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-6 py-4">
                    <div className="font-extrabold text-sm text-slate-900">{c.name}</div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 font-mono">
                      <Phone className="h-3 w-3" /> {c.phone}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-slate-600 font-medium">
                    {c.locationName}
                  </td>

                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                    {formatDate(c.deletedAt, "dd MMM yyyy")}
                  </td>

                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                    {formatDate(c.expiresAt, "dd MMM yyyy")}
                  </td>

                  <td className="px-6 py-4 text-center">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        c.daysRemaining <= 7
                          ? "bg-red-100 text-red-800"
                          : c.daysRemaining <= 14
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {c.daysRemaining} days
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleRestore(c)}
                      disabled={restoringId === c.id}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {restoringId === c.id ? "Restoring..." : "Restore"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  <Trash2 className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold">Recycle bin is empty</p>
                  <p className="text-[11px] mt-1">Deleted customers will appear here for 30 days.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
