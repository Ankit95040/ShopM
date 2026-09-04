"use client";

import { formatDate } from "@/lib/formatters";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { Prisma } from "@prisma/client";

export interface AuditLogItem {
  id: string;
  createdAt: string | Date;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string | null;
  changeReason?: string | null;
  previousValue?: Prisma.JsonValue;
  newValue?: Prisma.JsonValue;
}

function isIsDeletedOnly(prev: unknown, next: unknown): boolean {
  const isObj = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const p = isObj(prev) ? (prev as Record<string, unknown>) : null;
  const n = isObj(next) ? (next as Record<string, unknown>) : null;
  if (!p && !n) return false;
  const pKeys = p ? Object.keys(p) : [];
  const nKeys = n ? Object.keys(n) : [];
  const allKeys = new Set([...pKeys, ...nKeys]);
  if (allKeys.size === 0) return false;
  const technical = new Set(["isDeleted", "deletedAt", "deletedById"]);
  for (const k of allKeys) if (!technical.has(k)) return false;
  return allKeys.has("isDeleted");
}

function formatChangeCompact(prev: unknown, next: unknown): string | null {
  try {
    const p = prev as Record<string, unknown> | null;
    const n = next as Record<string, unknown> | null;
    if (p && n && typeof p === "object" && typeof n === "object" && !Array.isArray(p) && !Array.isArray(n)) {
      const allKeys = new Set([...Object.keys(p), ...Object.keys(n)]);
      // filter out technical isDeleted keys — never show them
      const meaningfulKeys = [...allKeys].filter((k) => !["isDeleted", "deletedAt", "deletedById"].includes(k));
      if (meaningfulKeys.length === 0) return null;
      const pKeys = Object.keys(p);
      const nKeys = Object.keys(n);
      if (meaningfulKeys.length === 1 && pKeys.length === 1 && nKeys.length === 1 && pKeys[0] === nKeys[0] && meaningfulKeys[0] === pKeys[0]) {
        const key = meaningfulKeys[0];
        return `${key}: ${String(p[key])} → ${String(n[key])}`;
      }
      const changed: string[] = [];
      for (const k of meaningfulKeys) {
        if (JSON.stringify((p as Record<string, unknown>)[k]) !== JSON.stringify((n as Record<string, unknown>)[k])) {
          changed.push(`${k}: ${String((p as Record<string, unknown>)[k] ?? "∅")} → ${String((n as Record<string, unknown>)[k] ?? "∅")}`);
        }
      }
      if (changed.length > 0 && changed.length <= 3) return changed.join(", ");
    }
  } catch {}
  return null;
}

function getEntityLabel(entityType: string): string {
  const map: Record<string, string> = {
    CUSTOMER: "Customer",
    LOCATION: "Location",
    TRANSACTION: "Transaction",
    INVENTORY: "Item",
    USER: "User",
  };
  return map[entityType] || entityType.charAt(0) + entityType.slice(1).toLowerCase();
}

function getActionPastLabel(action: string, entityLabel: string): string {
  const past: Record<string, string> = {
    RESTORE: "restored",
    DELETE: "deleted",
    CREATE: "created",
    UPDATE: "updated",
  };
  const verb = past[action] || action.toLowerCase();
  return `${entityLabel} ${verb}`;
}

function getActorLabel(action: string): string {
  const map: Record<string, string> = {
    RESTORE: "Restored by",
    DELETE: "Deleted by",
    CREATE: "Created by",
    UPDATE: "Updated by",
  };
  return map[action] || "Performed by";
}

export function AuditLogsView({ logs }: { logs: AuditLogItem[] }) {
  const { t } = useTranslation();

  return (
    <div className="px-4 pb-4 pt-6 sm:p-8 space-y-5 sm:space-y-6 max-w-7xl mx-auto min-w-0 overflow-hidden">
      {/* Header — mobile compact below fixed nav, desktop unchanged */}
      <div className="sm:hidden space-y-3">
        <div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight leading-tight break-words">
            {t("auditLogsTitle")}
          </h1>
          <p className="text-[11px] text-slate-400 mt-1 font-medium leading-snug break-words">
            {t("auditLogsSubtitle")}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>{t("tamperResistantBadge")}</span>
        </div>
      </div>
      <div className="hidden sm:flex flex-wrap items-center justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl break-words">
            {t("auditLogsTitle")}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 break-words">
            {t("auditLogsSubtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 border border-emerald-200 shrink-0">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="whitespace-nowrap">{t("tamperResistantBadge")}</span>
        </div>
      </div>

      {/* Mobile: vertical ledger — clear WHAT/WHO/WHO-DID-IT hierarchy, no isDeleted */}
      <div className="sm:hidden min-w-0">
        {logs.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => {
              const entityLabel = getEntityLabel(log.entityType);
              const whatLabel = getActionPastLabel(log.action, entityLabel);
              const actorLabel = getActorLabel(log.action);
              const affectedName = log.entityName || log.entityId.slice(0, 8);
              const isDelete = log.action === "DELETE";
              const isRestore = log.action === "RESTORE";
              return (
                <div key={log.id} className="py-5 min-w-0">
                  <span
                    className={`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-black leading-none ${
                      isDelete
                        ? "bg-red-100 text-red-800"
                        : isRestore
                        ? "bg-emerald-100 text-emerald-800"
                        : log.action === "UPDATE"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {log.action}
                  </span>

                  <div className="mt-3 min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-none">
                      {whatLabel}
                    </div>
                    <div className="mt-1.5 text-sm font-black text-slate-900 break-words leading-tight">{affectedName}</div>
                    <div className="text-[11px] text-slate-500 break-words">{entityLabel}</div>
                  </div>

                  <div className="mt-4 min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-none">{actorLabel}</div>
                    <div className="mt-1.5 text-sm font-semibold text-slate-800 break-words leading-tight">{log.userName}</div>
                  </div>

                  <div className="mt-4 text-[11px] font-medium text-slate-400 break-words">
                    {formatDate(log.createdAt, "dd MMM yyyy • hh:mm a")}
                  </div>

                  {log.changeReason ? (
                    <p className="mt-3 text-xs leading-snug text-slate-600 break-words min-w-0 border-t border-slate-100 pt-3">
                      {log.changeReason}
                    </p>
                  ) : null}

                  {(() => {
                    if (isIsDeletedOnly(log.previousValue, log.newValue)) return null;
                    const compact = formatChangeCompact(log.previousValue, log.newValue);
                    if (compact) {
                      if (compact.includes("isDeleted")) return null;
                      return (
                        <div className="mt-3 flex items-start gap-1.5 min-w-0 border-t border-slate-100 pt-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mt-[1px]">Changed</span>
                          <span className="font-mono text-[11px] leading-snug text-slate-600 break-all min-w-0">{compact}</span>
                        </div>
                      );
                    }
                    const raw =
                      log.previousValue && log.newValue
                        ? `${JSON.stringify(log.previousValue)} → ${JSON.stringify(log.newValue)}`
                        : log.newValue
                        ? JSON.stringify(log.newValue)
                        : "";
                    if (!raw) return null;
                    if (raw.includes("isDeleted")) return null;
                    return (
                      <div className="mt-3 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2 min-w-0 overflow-hidden">
                        <p className="font-mono text-[10px] leading-relaxed text-slate-500 break-all min-w-0 whitespace-pre-wrap">
                          {raw}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-10 text-center text-xs text-slate-400 break-words">{t("noAuditLogsFound")}</p>
        )}
      </div>

      {/* Desktop: table layout — unchanged */}
      <div className="hidden sm:block overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 whitespace-nowrap w-[160px]">{t("timestampCol")}</th>
                <th className="px-5 py-3.5 whitespace-nowrap">{t("userCol")}</th>
                <th className="px-5 py-3.5 whitespace-nowrap">{t("actionCol")}</th>
                <th className="px-5 py-3.5">{t("changeReasonCol")}</th>
                <th className="px-5 py-3.5 min-w-[200px]">{t("diffCol")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                      {formatDate(log.createdAt, "dd MMM yyyy, hh:mm a")}
                    </td>

                    <td className="px-5 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                      {log.userName}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${
                          log.action === "DELETE"
                            ? "bg-red-100 text-red-800"
                            : log.action === "RESTORE"
                            ? "bg-blue-100 text-blue-800"
                            : log.action === "UPDATE"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-slate-600 font-medium">
                      {log.changeReason || "-"}
                    </td>

                    <td className="px-5 py-3.5">
                      {(() => {
                        if (isIsDeletedOnly(log.previousValue, log.newValue)) return <span className="text-slate-400">—</span>;
                        const raw =
                          log.previousValue && log.newValue
                            ? `${JSON.stringify(log.previousValue)} → ${JSON.stringify(log.newValue)}`
                            : log.newValue
                            ? JSON.stringify(log.newValue)
                            : "";
                        if (!raw) return <span className="text-slate-400">—</span>;
                        if (raw.includes("isDeleted")) return <span className="text-slate-400">—</span>;
                        return (
                          <div className="max-w-sm truncate font-mono text-[10px] bg-slate-50 p-2 rounded-xl border border-slate-200 text-slate-700">
                            {raw}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    {t("noAuditLogsFound")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
