import type { QueryTiming } from "@/lib/performance/types";

interface QueryStoreState {
  allQueries: QueryTiming[];
  storeId: string;
}

const MAX_QUERIES = 5000;

function getStore(): QueryStoreState {
  const g = globalThis as unknown as { __perfQueryStore?: QueryStoreState };
  if (!g.__perfQueryStore) {
    g.__perfQueryStore = {
      allQueries: [],
      storeId: Math.random().toString(36).slice(2, 8),
    };
  }
  return g.__perfQueryStore;
}

export function getQueryStoreId(): string {
  return getStore().storeId;
}

export function recordQuery(query: QueryTiming) {
  const store = getStore();
  store.allQueries.push(query);
  if (store.allQueries.length > MAX_QUERIES) {
    store.allQueries.splice(0, store.allQueries.length - MAX_QUERIES);
  }
}

export function getRecordedQueries(): QueryTiming[] {
  return getStore().allQueries;
}

export function clearRecordedQueries() {
  getStore().allQueries.length = 0;
}
