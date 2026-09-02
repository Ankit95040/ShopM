"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, RotateCcw, Building2, Phone, Clock } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { restoreCustomerAction } from "@/server/actions/customer.actions";
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

export function RecycleBinView({
  initialCustomers,
}: {
  initialCustomers: DeletedCustomer[];
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [customers, setCustomers] = useState(initialCustomers);
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

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
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
