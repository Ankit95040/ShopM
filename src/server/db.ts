import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { recordQuery } from "@/lib/performance/query-store";
import { asyncLocalStorage } from "@/lib/performance/context";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://ankitraj@localhost:5432/shopm?schema=public";

function parseSqlMeta(sql: string): { model: string; operation: string } {
  const upper = sql.toUpperCase().trim();
  if (upper.startsWith("BEGIN")) return { model: "Transaction", operation: "begin" };
  if (upper.startsWith("COMMIT")) return { model: "Transaction", operation: "commit" };
  if (upper.startsWith("ROLLBACK")) return { model: "Transaction", operation: "rollback" };

  const modelMatch = sql.match(/(?:from|into|update|join)\s+"?(\w+)"?\s*\.?\s*"?(\w+)"?/i);
  let model = "Unknown";
  if (modelMatch) {
    model = modelMatch[2] || modelMatch[1];
  }

  if (upper.startsWith("SELECT")) return { model, operation: "findMany" };
  if (upper.startsWith("INSERT")) return { model, operation: "create" };
  if (upper.startsWith("UPDATE")) return { model, operation: "update" };
  if (upper.startsWith("DELETE")) return { model, operation: "delete" };
  if (upper.startsWith("WITH")) return { model, operation: "query" };
  return { model, operation: "query" };
}

class InstrumentedPool extends Pool {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query(...args: any[]) {
    const startMs = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (super.query as any)(...args);
    const duration = Date.now() - startMs;

    const config = args[0];
    const sql = typeof config === "string" ? config : config?.text || "";
    const { model, operation } = parseSqlMeta(sql);
    const queryData = { model, operation, duration, timestamp: Date.now() };

    recordQuery(queryData);

    // Update per-operation DB duration via async local storage
    const ctx = asyncLocalStorage.getStore();
    if (ctx) {
      ctx.totalDbMs += duration;
      ctx.queryCount++;
      ctx.queries.push(queryData);
    }

    return result;
  }
}

const pool = new InstrumentedPool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

if (process.env.NODE_ENV === "development") {
  globalForPrisma.prisma = new PrismaClient({
    adapter,
    log: ["query", "error", "warn"],
  });
} else if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient({
    adapter,
    log: ["error"],
  });
}

export const db = globalForPrisma.prisma!;
