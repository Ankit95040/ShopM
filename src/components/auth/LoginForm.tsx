"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LockKeyhole, Store, UserRound, ArrowRight } from "lucide-react";
import { loginAction, LoginActionState } from "@/server/actions/auth.actions";

const initialState: LoginActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <div className="min-h-screen flex">
      {/* Left: Branded panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[45%] bg-slate-900 relative overflow-hidden">
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Top: Brand */}
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 font-extrabold text-white text-sm tracking-tight backdrop-blur-sm border border-white/10">
                SM
              </div>
              <span className="text-xl font-black tracking-tight text-white">
                Shop<span className="text-sky-400">M</span>
              </span>
            </div>
          </div>

          {/* Center: Value proposition */}
          <div className="py-12">
            <h1 className="text-4xl xl:text-5xl font-black leading-[1.1] tracking-tight text-white mb-5">
              Everything your shop needs,
              <br />
              <span className="text-sky-400">in one place.</span>
            </h1>
            <p className="text-base text-slate-400 leading-relaxed max-w-md">
              Manage billing, customer ledgers, inventory and your team with ease.
              One powerful platform for your daily shop operations.
            </p>
          </div>

          {/* Bottom: Feature pills */}
          <div className="flex flex-wrap gap-2">
            {["Billing & Khata", "Customer Ledgers", "Inventory", "Team Management"].map((f) => (
              <span key={f} className="inline-flex items-center rounded-full bg-white/5 border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-slate-300">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Decorative gradient orb */}
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute top-20 -right-20 w-64 h-64 rounded-full bg-sky-600/5 blur-3xl" />
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-4 py-10 sm:px-6 sm:py-12">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden mb-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 font-extrabold text-white text-xs tracking-tight shadow-md">
                SM
              </div>
              <span className="text-lg font-black tracking-tight text-slate-900">
                Shop<span className="text-sky-600">M</span>
              </span>
            </div>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 font-medium">
              Sign in to continue managing your shop.
            </p>
          </div>

          {/* Form card */}
          <form
            action={action}
            className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm"
          >
            <div className="space-y-4">
              {/* Shop ID */}
              <label className="block">
                <span className="text-xs font-bold text-slate-700">Shop ID</span>
                <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 py-0 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                  <Store className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    name="shopCode"
                    type="text"
                    autoComplete="organization"
                    placeholder="e.g. SHARMA-STORE"
                    className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 min-h-[44px]"
                  />
                </div>
              </label>

              {/* User ID */}
              <label className="block">
                <span className="text-xs font-bold text-slate-700">Login ID</span>
                <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 py-0 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                  <UserRound className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    name="loginId"
                    type="text"
                    autoComplete="username"
                    placeholder="e.g. rahul"
                    className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 min-h-[44px]"
                  />
                </div>
              </label>

              {/* Password */}
              <label className="block">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Password</span>
                  <Link
                    href="/forgot-password"
                    className="text-[11px] font-bold text-sky-600 hover:text-sky-700 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 py-0 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                  <LockKeyhole className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 min-h-[44px]"
                  />
                </div>
              </label>

              {/* Error */}
              {state.error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700 animate-in fade-in slide-in-from-top-1 duration-200">
                  {state.error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] flex items-center justify-center gap-2"
              >
                {pending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            {/* Footer links */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-center space-y-3">
              <p className="text-xs text-slate-500">
                Don&apos;t have an account?{" "}
                <Link
                  href="/register"
                  className="font-bold text-sky-600 hover:text-sky-700 transition-colors"
                >
                  Create your shop
                </Link>
              </p>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <Link
                href="/"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 min-h-[44px]"
              >
                Try demo without login
              </Link>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Explore Dashboard, Billing, Inventory & Reports with temporary demo data.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}