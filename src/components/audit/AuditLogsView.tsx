"use client";

import { formatDate } from "@/lib/formatters";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export interface AuditLogItem {
  id: string;
  createdAt: string | Date;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  changeReason?: string | null;
  previousValue?: any;
  newValue?: any;
}

export function AuditLogsView({ logs }: { logs: AuditLogItem[] }) {
  const { t } = useTranslation();

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
            {t("auditLogsTitle")}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t("auditLogsSubtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 border border-emerald-200">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>{t("tamperResistantBadge")}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">{t("timestampCol")}</th>
              <th className="px-6 py-4">{t("userCol")}</th>
              <th className="px-6 py-4">{t("actionCol")}</th>
              <th className="px-6 py-4">{t("entityCol")}</th>
              <th className="px-6 py-4">{t("changeReasonCol")}</th>
              <th className="px-6 py-4">{t("diffCol")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length > 0 ? (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                    {formatDate(log.createdAt, "dd MMM yyyy, hh:mm a")}
                  </td>

                  <td className="px-6 py-4 font-bold text-slate-900">
                    {log.userName}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${
                        log.action === "DELETE"
                          ? "bg-red-100 text-red-800"
                          : log.action === "UPDATE"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>

                  <td className="px-6 py-4 font-semibold text-slate-800">
                    {log.entityType} #{log.entityId.slice(-6)}
                  </td>

                  <td className="px-6 py-4 text-slate-600 font-medium">
                    {log.changeReason || "-"}
                  </td>

                  <td className="px-6 py-4">
                    <div className="max-w-xs truncate font-mono text-[10px] bg-slate-50 p-2 rounded-xl border border-slate-200 text-slate-700">
                      {log.previousValue && log.newValue
                        ? `${JSON.stringify(log.previousValue)} → ${JSON.stringify(log.newValue)}`
                        : log.newValue
                        ? JSON.stringify(log.newValue)
                        : "State recorded"}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  {t("noAuditLogsFound")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
