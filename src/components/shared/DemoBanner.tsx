"use client";

import { useState } from "react";
import Link from "next/link";
import { X, FlaskConical } from "lucide-react";

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="sticky top-0 z-50 w-full border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-start gap-2 text-xs font-medium text-amber-900">
          <FlaskConical className="h-4 w-4 shrink-0 text-amber-600 mt-0.5 sm:mt-0" />
          <span className="leading-relaxed">
            You’re using ShopM in demo mode. Your data is temporary. To keep your data, log in or register.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:ml-4">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1.5 text-xs font-bold text-amber-900 border border-amber-200 hover:bg-amber-100 transition min-h-[32px]"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition min-h-[32px]"
          >
            Register
          </Link>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-amber-700 hover:bg-amber-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
