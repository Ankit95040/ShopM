export type OperationStatus = "FAST" | "OK" | "SLOW" | "VERY_SLOW";

export interface QueryTiming {
  model: string;
  operation: string;
  duration: number;
  timestamp: number;
}

export interface OperationEntry {
  name: string;
  type: "route" | "action" | "auth";
  calls: number;
  durations: number[];
  dbDurations: number[];
  queryCounts: number[];
  authDurations: number[];
  timestamps: number[];
  statuses: OperationStatus[];
  details: OperationDetail[];
}

export interface OperationDetail {
  timestamp: number;
  totalDuration: number;
  dbDuration: number;
  authDuration: number;
  queryCount: number;
  status: OperationStatus;
  queries: QueryTiming[];
}

export interface RouteEntry {
  name: string;
  calls: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  avgDbDuration: number;
  avgQueryCount: number;
  status: OperationStatus;
}

export interface ActionEntry {
  name: string;
  calls: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  avgDbDuration: number;
  avgQueryCount: number;
  status: OperationStatus;
}

export interface PerformanceSnapshot {
  routes: RouteEntry[];
  actions: ActionEntry[];
  queries: QueryTiming[];
  totalOperations: number;
  slowOperations: number;
  verySlowOperations: number;
}

export function classifyStatus(durationMs: number): OperationStatus {
  if (durationMs < 500) return "FAST";
  if (durationMs < 1000) return "OK";
  if (durationMs < 2000) return "SLOW";
  return "VERY_SLOW";
}

export function formatDuration(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function getStatusColor(status: OperationStatus): string {
  switch (status) {
    case "FAST": return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "OK": return "text-blue-700 bg-blue-50 border-blue-200";
    case "SLOW": return "text-amber-700 bg-amber-50 border-amber-200";
    case "VERY_SLOW": return "text-red-700 bg-red-50 border-red-200";
  }
}
