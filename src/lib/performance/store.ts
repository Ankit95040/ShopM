import type { OperationEntry, OperationDetail, PerformanceSnapshot, RouteEntry, ActionEntry, QueryTiming } from "@/lib/performance/types";
import { getRecordedQueries, recordQuery as recordQueryToStore, clearRecordedQueries } from "@/lib/performance/query-store";

interface PerfStoreState {
  routes: Map<string, OperationEntry>;
  actions: Map<string, OperationEntry>;
}

function getStore(): PerfStoreState {
  const g = globalThis as unknown as { __perfStore?: PerfStoreState };
  if (!g.__perfStore) {
    g.__perfStore = {
      routes: new Map<string, OperationEntry>(),
      actions: new Map<string, OperationEntry>(),
    };
  }
  return g.__perfStore;
}

function getOrCreateEntry(
  map: Map<string, OperationEntry>,
  name: string,
  type: "route" | "action" | "auth"
): OperationEntry {
  let entry = map.get(name);
  if (!entry) {
    entry = {
      name,
      type,
      calls: 0,
      durations: [],
      dbDurations: [],
      queryCounts: [],
      authDurations: [],
      timestamps: [],
      statuses: [],
      details: [],
    };
    map.set(name, entry);
  }
  return entry;
}

function computeStats(durations: number[]) {
  if (durations.length === 0) return { avg: 0, min: 0, max: 0 };
  const sum = durations.reduce((a, b) => a + b, 0);
  return {
    avg: sum / durations.length,
    min: Math.min(...durations),
    max: Math.max(...durations),
  };
}

function toEntryList(map: Map<string, OperationEntry>): (RouteEntry | ActionEntry)[] {
  return Array.from(map.values()).map((e) => {
    const durationStats = computeStats(e.durations);
    const dbStats = computeStats(e.dbDurations);
    const avgQueryCount =
      e.queryCounts.length > 0
        ? e.queryCounts.reduce((a, b) => a + b, 0) / e.queryCounts.length
        : 0;
    const lastStatus = e.statuses.length > 0 ? e.statuses[e.statuses.length - 1] : "FAST" as const;
    return {
      name: e.name,
      calls: e.calls,
      avgDuration: durationStats.avg,
      minDuration: durationStats.min,
      maxDuration: durationStats.max,
      avgDbDuration: dbStats.avg,
      avgQueryCount: Math.round(avgQueryCount * 10) / 10,
      status: lastStatus,
    };
  });
}

function addToEntry(entry: OperationEntry, detail: OperationDetail) {
  entry.calls++;
  entry.durations.push(detail.totalDuration);
  entry.dbDurations.push(detail.dbDuration);
  entry.queryCounts.push(detail.queryCount);
  entry.authDurations.push(detail.authDuration);
  entry.timestamps.push(detail.timestamp);
  entry.statuses.push(detail.status);
  entry.details.push(detail);

  if (entry.details.length > 100) {
    entry.details = entry.details.slice(-100);
    entry.durations = entry.durations.slice(-100);
    entry.dbDurations = entry.dbDurations.slice(-100);
    entry.queryCounts = entry.queryCounts.slice(-100);
    entry.authDurations = entry.authDurations.slice(-100);
    entry.timestamps = entry.timestamps.slice(-100);
    entry.statuses = entry.statuses.slice(-100);
  }
}

export function recordRoutePerformance(name: string, detail: OperationDetail) {
  const { routes } = getStore();
  const entry = getOrCreateEntry(routes, name, "route");
  addToEntry(entry, detail);
}

export function recordActionPerformance(name: string, detail: OperationDetail) {
  const { actions } = getStore();
  const entry = getOrCreateEntry(actions, name, "action");
  addToEntry(entry, detail);
}

export function recordQuery(query: QueryTiming) {
  recordQueryToStore(query);
}

export function getPerformanceSnapshot(): PerformanceSnapshot {
  const { routes, actions } = getStore();
  const routeList = toEntryList(routes);
  const actionList = toEntryList(actions);
  const allQueries = getRecordedQueries();

  const allEntries = [...routeList, ...actionList];
  const totalOps = allEntries.reduce((s, e) => s + e.calls, 0);
  const slowOps = allEntries.reduce(
    (s, e) => s + (e.status === "SLOW" ? e.calls : 0),
    0
  );
  const verySlowOps = allEntries.reduce(
    (s, e) => s + (e.status === "VERY_SLOW" ? e.calls : 0),
    0
  );

  return {
    routes: routeList.sort((a, b) => b.avgDuration - a.avgDuration),
    actions: actionList.sort((a, b) => b.avgDuration - a.avgDuration),
    queries: allQueries.slice(-200),
    totalOperations: totalOps,
    slowOperations: slowOps,
    verySlowOperations: verySlowOps,
  };
}

export function clearPerformanceData() {
  const { routes, actions } = getStore();
  routes.clear();
  actions.clear();
  clearRecordedQueries();
}
