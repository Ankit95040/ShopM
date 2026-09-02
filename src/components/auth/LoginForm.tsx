"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LockKeyhole, Store, UserRound } from "lucide-react";
import { loginAction, LoginActionState } from "@/server/actions/auth.actions";

const initialState: LoginActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white shadow-md">
            SM
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-900">
            Sign in to ShopM
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Use your Shop ID, User ID, and password.
          </p>
        </div>

        <form
          action={action}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-700">Shop ID</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-slate-900">
                <Store className="h-4 w-4 text-slate-400" />
                <input
                  name="shopCode"
                  type="text"
                  autoComplete="organization"
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">User ID</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-slate-900">
                <UserRound className="h-4 w-4 text-slate-400" />
                <input
                  name="loginId"
                  type="text"
                  autoComplete="username"
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">Password</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-slate-900">
                <LockKeyhole className="h-4 w-4 text-slate-400" />
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                />
              </div>
            </label>

            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-xs font-bold text-sky-600 hover:text-sky-700 transition"
              >
                Forgot Password?
              </Link>
            </div>

            {state.error && (
              <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                {state.error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "Signing in..." : "Sign in"}
            </button>
          </div>

          <div className="mt-5 text-center">
            <p className="text-xs text-slate-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-bold text-sky-600 hover:text-sky-700 transition"
              >
                Create your shop
              </Link>
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
