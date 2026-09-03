import { asyncLocalStorage, startOperation, completeOperation } from "@/lib/performance/context";
import { recordRoutePerformance, recordActionPerformance } from "@/lib/performance/store";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

export function withPerformance<T extends AnyFn>(
  name: string,
  type: "route" | "action" | "auth",
  fn: T
): T {
  const wrapped = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const ctx = startOperation(name, type);
    try {
      const result = await asyncLocalStorage.run(ctx, () => fn(...args));
      return result;
    } catch (error) {
      throw error;
    } finally {
      const detail = completeOperation(ctx);
      if (type === "route") {
        recordRoutePerformance(name, detail);
      } else {
        recordActionPerformance(name, detail);
      }
    }
  };
  return wrapped as unknown as T;
}

export { asyncLocalStorage } from "@/lib/performance/context";
