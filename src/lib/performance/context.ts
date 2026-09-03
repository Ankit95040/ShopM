import { AsyncLocalStorage } from "async_hooks";
import type { OperationDetail, QueryTiming } from "./types";
import { classifyStatus } from "./types";

export interface OperationContext {
  name: string;
  type: "route" | "action" | "auth";
  startMs: number;
  totalDbMs: number;
  totalAuthMs: number;
  queryCount: number;
  queries: QueryTiming[];
}

export const asyncLocalStorage = new AsyncLocalStorage<OperationContext>();

export function startOperation(
  name: string,
  type: "route" | "action" | "auth"
): OperationContext {
  return {
    name,
    type,
    startMs: Date.now(),
    totalDbMs: 0,
    totalAuthMs: 0,
    queryCount: 0,
    queries: [],
  };
}

export function completeOperation(ctx: OperationContext): OperationDetail {
  const totalDuration = Date.now() - ctx.startMs;
  return {
    timestamp: ctx.startMs,
    totalDuration,
    dbDuration: ctx.totalDbMs,
    authDuration: ctx.totalAuthMs,
    queryCount: ctx.queryCount,
    status: classifyStatus(totalDuration),
    queries: ctx.queries,
  };
}
