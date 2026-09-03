"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Trash2, Download, ChevronDown, ChevronRight, AlertTriangle, Search } from "lucide-react";
import { formatDuration, type PerformanceSnapshot, type RouteEntry, type ActionEntry, type OperationEntry } from "@/lib/performance/types";

type Tab = "routes" | "actions" | "queries";

export function PerformanceDashboard() {
  const [data, setData] = useState<PerformanceSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("routes");
  const [slowOnly, setSlowOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, OperationEntry>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/dev/performance");
        if (res.ok && active) {
          const json = await res.json();
          setData(json);
          setLastUpdate(Date.now());
        }
      } catch (e) {
        console.error("Performance fetch error:", e);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleClear = async () => {
    await fetch("/api/dev/performance/clear", { method: "POST" });
    setData(null);
    setDetails({});
    setExpandedRow(null);
    try {
      const res = await fetch("/api/dev/performance");
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
  };

  const handleExport = () => {
    if (!data) return;
    const exportData = {
      exportedAt: new Date().toISOString(),
      summary: {
        totalOperations: data.totalOperations,
        slowOperations: data.slowOperations,
        verySlowOperations: data.verySlowOperations,
      },
      routes: data.routes,
      actions: data.actions,
      recentQueries: data.queries,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shopm-performance-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleExpand = async (name: string, type: "route" | "action") => {
    if (expandedRow === name) {
      setExpandedRow(null);
      return;
    }
    setExpandedRow(name);
    if (!details[name]) {
      try {
        const res = await fetch(`/api/dev/performance`);
        if (res.ok) {
          const json: PerformanceSnapshot = await res.json();
          const list = type === "route" ? json.routes : json.actions;
          const entry = list.find((e) => e.name === name);
          if (entry) {
            // Summary data available; full detail not exposed by API
          }
        }
      } catch {
        // ignore
      }
    }
  };

  const filterEntries = <T extends { name: string; status: string; calls: number }>(
    entries: T[]
  ): T[] => {
    let filtered = entries;
    if (slowOnly) {
      filtered = filtered.filter((e) => e.status === "SLOW" || e.status === "VERY_SLOW");
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((e) => e.name.toLowerCase().includes(q));
    }
    return filtered;
  };

  const filteredRoutes = filterEntries(data?.routes || []);
  const filteredActions = filterEntries(data?.actions || []);

  if (loading && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading performance data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Performance Monitor</h1>
          <p className="text-xs text-slate-500 mt-1">Dev only — data resets on server restart — refreshes every 1s</p>
          {lastUpdate > 0 && (
            <p className="text-[10px] text-slate-400 mt-0.5">Last update: {new Date(lastUpdate).toLocaleTimeString()}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => { try { const r = await fetch("/api/dev/performance"); if (r.ok) { setData(await r.json()); setLastUpdate(Date.now()); } } catch { /* ignore */ } }}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total Operations" value={data?.totalOperations || 0} />
        <SummaryCard label="Routes" value={data?.routes.length || 0} />
        <SummaryCard label="Actions" value={data?.actions.length || 0} />
        <SummaryCard
          label="Slow Ops"
          value={data?.slowOperations || 0}
          alert={(data?.slowOperations || 0) > 0}
          veryAlert={(data?.verySlowOperations || 0) > 0}
        />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search operations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
          <input
            type="checkbox"
            checked={slowOnly}
            onChange={(e) => setSlowOnly(e.target.checked)}
            className="rounded border-slate-300"
          />
          Slow only
        </label>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {(["routes", "actions", "queries"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition ${
              activeTab === tab
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "routes" && `Routes (${filteredRoutes.length})`}
            {tab === "actions" && `Actions (${filteredActions.length})`}
            {tab === "queries" && `Queries (${data?.queries.length || 0})`}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "routes" && (
        <div className="space-y-2">
          {filteredRoutes.length === 0 ? (
            <EmptyState message="No route data yet. Navigate to pages to collect data." />
          ) : (
            filteredRoutes.map((route) => (
              <EntryRow
                key={route.name}
                entry={route}
                expanded={expandedRow === route.name}
                onToggle={() => toggleExpand(route.name, "route")}
              />
            ))
          )}
        </div>
      )}

      {activeTab === "actions" && (
        <div className="space-y-2">
          {filteredActions.length === 0 ? (
            <EmptyState message="No action data yet. Perform actions to collect data." />
          ) : (
            filteredActions.map((action) => (
              <EntryRow
                key={action.name}
                entry={action}
                expanded={expandedRow === action.name}
                onToggle={() => toggleExpand(action.name, "action")}
              />
            ))
          )}
        </div>
      )}

      {activeTab === "queries" && (
        <div className="space-y-2">
          {(!data?.queries || data.queries.length === 0) ? (
            <EmptyState message="No query data yet. Perform operations to collect data." />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-2.5 text-left font-bold text-slate-600">Model</th>
                      <th className="px-4 py-2.5 text-left font-bold text-slate-600">Operation</th>
                      <th className="px-4 py-2.5 text-right font-bold text-slate-600">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.queries.slice().reverse().slice(0, 100).map((q, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2 font-mono text-slate-700">{q.model}</td>
                        <td className="px-4 py-2 text-slate-600">{q.operation}</td>
                        <td className="px-4 py-2 text-right">
                          <StatusBadge duration={q.duration} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  alert,
  veryAlert,
}: {
  label: string;
  value: number;
  alert?: boolean;
  veryAlert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        veryAlert
          ? "border-red-200 bg-red-50"
          : alert
            ? "border-amber-200 bg-amber-50"
            : "border-slate-200 bg-white"
      }`}
    >
      <span className="text-[11px] font-bold text-slate-500">{label}</span>
      <div className={`mt-1 text-2xl font-black ${veryAlert ? "text-red-700" : alert ? "text-amber-700" : "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: RouteEntry | ActionEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/50 transition"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-xs font-bold text-slate-800">{entry.name}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-bold text-slate-500">{entry.calls} calls</span>
          <StatusBadge duration={entry.avgDuration} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricBox label="Avg" value={formatDuration(entry.avgDuration)} />
            <MetricBox label="Min" value={formatDuration(entry.minDuration)} />
            <MetricBox label="Max" value={formatDuration(entry.maxDuration)} />
            <MetricBox label="DB Avg" value={formatDuration(entry.avgDbDuration)} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricBox label="Calls" value={String(entry.calls)} />
            <MetricBox label="Avg Queries" value={String(entry.avgQueryCount)} />
            <MetricBox label="Status" value={entry.status} />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
      <span className="text-[10px] font-bold text-slate-400">{label}</span>
      <div className="text-xs font-black text-slate-800">{value}</div>
    </div>
  );
}

function StatusBadge({ duration }: { duration: number }) {
  let status: string;
  let color: string;
  if (duration < 500) {
    status = "FAST";
    color = "text-emerald-700 bg-emerald-50 border-emerald-200";
  } else if (duration < 1000) {
    status = "OK";
    color = "text-blue-700 bg-blue-50 border-blue-200";
  } else if (duration < 2000) {
    status = "SLOW";
    color = "text-amber-700 bg-amber-50 border-amber-200";
  } else {
    status = "VERY SLOW";
    color = "text-red-700 bg-red-50 border-red-200";
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${color}`}>
      {(status === "SLOW" || status === "VERY SLOW") && <AlertTriangle className="h-2.5 w-2.5" />}
      {formatDuration(duration)}
      <span className="opacity-60">{status}</span>
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-xs text-slate-400">{message}</p>
    </div>
  );
}
