"use client";

import { useState, useEffect } from "react";
import { Database, X, Copy } from "lucide-react";
import { getDemoDataSummaryAction, copyDemoDataToShopAction } from "@/server/actions/demo.actions";

export function KeepDemoDataBanner() {
  const [hasDemoData, setHasDemoData] = useState(false);
  const [counts, setCounts] = useState<{ locations: number; customers: number; transactions: number } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  useEffect(() => {
    getDemoDataSummaryAction().then((res) => {
      if (res.success && res.hasDemoData) {
        setHasDemoData(true);
        if (res.counts) setCounts(res.counts);
      }
    });
  }, []);

  if (!hasDemoData || dismissed) return null;

  const handleCopy = async () => {
    setIsCopying(true);
    const res = await copyDemoDataToShopAction();
    setIsCopying(false);
    if (res.success) {
      setHasDemoData(false);
      window.location.reload();
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Database className="h-5 w-5 text-sky-600 mt-0.5" />
          <div className="text-xs">
            <div className="font-bold text-sky-900">Keep your demo data?</div>
            <div className="text-sky-700 mt-0.5">
              You have demo data{counts ? ` (${counts.locations} locations, ${counts.customers} customers, ${counts.transactions} transactions)` : ""}. Copy it to your new shop?
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            disabled={isCopying}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 min-h-[36px]"
          >
            <Copy className="h-3.5 w-3.5" />
            {isCopying ? "Copying..." : "Keep demo data"}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sky-600 hover:bg-sky-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
