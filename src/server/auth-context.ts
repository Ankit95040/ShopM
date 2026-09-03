import { AsyncLocalStorage } from "async_hooks";
import type { AuthContext } from "@/server/auth";

export interface AuthStore {
  session: AuthContext | null;
}

export const authAsyncLocalStorage = new AsyncLocalStorage<AuthStore>();

/**
 * Run a function within a request-scoped auth context.
 * The resolved session is shared across all code within this scope.
 * Separate HTTP requests get separate ALS instances (guaranteed by Node.js ALS).
 */
export async function runWithAuth<T>(fn: () => Promise<T>): Promise<T> {
  return authAsyncLocalStorage.run({ session: null }, fn);
}

/**
 * Get the cached session from the current request context.
 * Returns null if no auth context is established (standalone Server Action).
 */
export function getAuthFromContext(): AuthContext | null {
  const store = authAsyncLocalStorage.getStore();
  return store?.session ?? null;
}

/**
 * Cache a resolved session in the current request context.
 * Called once per request; subsequent calls within the same scope reuse the result.
 */
export function setAuthInContext(session: AuthContext): void {
  const store = authAsyncLocalStorage.getStore();
  if (store) {
    store.session = session;
  }
}
