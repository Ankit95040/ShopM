"use client";

import { useActionState, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Store,
  UserRound,
  Mail,
  ShieldCheck,
  KeyRound,
  CheckCircle,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  registerValidateShopAction,
  registerCreateOwnerAction,
  verifyRegistrationOtpAction,
  resendRegistrationOtpAction,
  type RegisterActionState,
} from "@/server/actions/register.actions";

const initialShopState: RegisterActionState = { step: "shop" };

export function RegisterWizard() {
  const router = useRouter();
  const [shopState, shopAction, shopPending] = useActionState(registerValidateShopAction, initialShopState);
  const [ownerState, ownerAction, ownerPending] = useActionState(registerCreateOwnerAction, shopState);
  const [otpState, otpAction, otpPending] = useActionState(verifyRegistrationOtpAction, ownerState);
  const [resendState, resendAction] = useActionState(resendRegistrationOtpAction, otpState);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const currentStep = resendState.step || otpState.step || ownerState.step || shopState.step;

  useEffect(() => {
    if (currentStep === "success") {
      const timer = setTimeout(() => router.push("/"), 1500);
      return () => clearTimeout(timer);
    }
  }, [currentStep, router]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResendOtp = useCallback(async () => {
    if (resendCooldown > 0) return;
    const form = new FormData();
    form.set("shopCode", shopState.shopCode || "");
    form.set("loginId", ownerState.loginId || otpState.loginId || "");
    form.set("email", otpState.email || "");
    await resendAction(form);
    setResendCooldown(60);
  }, [resendCooldown, shopState.shopCode, ownerState.loginId, otpState.loginId, otpState.email, resendAction]);

  const stepper = [
    { key: "shop", label: "Shop" },
    { key: "owner", label: "Owner" },
    { key: "otp", label: "Verify" },
  ];

  const currentStepIndex = stepper.findIndex((s) => s.key === currentStep);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        {/* Header */}
        <div>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Login
          </Link>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white shadow-md">
            SM
          </div>
          <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Create your Shop
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Set up your shop and start managing your business.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1.5">
          {stepper.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1.5 flex-1">
              <div
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= currentStepIndex ? "bg-slate-900" : "bg-slate-200"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Step 1: Shop Details */}
        {currentStep === "shop" && (
          <form
            action={shopAction}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Store className="h-5 w-5 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900">Shop Details</h2>
            </div>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">Shop Name</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-slate-900">
                <Store className="h-4 w-4 text-slate-400" />
                <input
                  name="shopName"
                  type="text"
                  placeholder="e.g. Sharma Building Materials"
                  required
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none min-h-[44px]"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">Shop ID</span>
              <p className="mt-0.5 text-[11px] text-slate-400">
                This is the unique ID you will use to log in. Use letters, numbers, or hyphens.
              </p>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-slate-900">
                <Store className="h-4 w-4 text-slate-400" />
                <input
                  name="shopCode"
                  type="text"
                  placeholder="e.g. SHARMA-BUILDERS"
                  autoComplete="organization"
                  required
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none min-h-[44px]"
                />
              </div>
            </label>

            {shopState.error && (
              <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                {shopState.error}
              </div>
            )}

            <button
              type="submit"
              disabled={shopPending}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50 min-h-[44px]"
            >
              {shopPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking...
                </span>
              ) : (
                "Continue"
              )}
            </button>
          </form>
        )}

        {/* Step 2: Owner Details */}
        {currentStep === "owner" && (
          <form
            action={ownerAction}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          >
            <input type="hidden" name="shopCode" value={shopState.shopCode || ""} />
            <input type="hidden" name="shopName" value={shopState.shopName || ""} />

            <div className="flex items-center gap-2 mb-2">
              <UserRound className="h-5 w-5 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900">Owner Account</h2>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-500">
              Creating shop: <span className="font-bold text-slate-700">{shopState.shopName}</span>
              {" "}(<span className="font-mono font-bold text-slate-700">{shopState.shopCode}</span>)
            </div>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">Full Name</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-slate-900">
                <UserRound className="h-4 w-4 text-slate-400" />
                <input
                  name="userName"
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Rahul Sharma"
                  required
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none min-h-[44px]"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">User ID</span>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Your personal login ID for this shop.
              </p>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-slate-900">
                <UserRound className="h-4 w-4 text-slate-400" />
                <input
                  name="loginId"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. rahul"
                  required
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none min-h-[44px]"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">Email</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-slate-900">
                <Mail className="h-4 w-4 text-slate-400" />
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="rahul@example.com"
                  required
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none min-h-[44px]"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">Password</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-slate-900">
                <KeyRound className="h-4 w-4 text-slate-400" />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={6}
                  required
                  placeholder="Min. 6 characters"
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">Confirm Password</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-slate-900">
                <KeyRound className="h-4 w-4 text-slate-400" />
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={6}
                  required
                  placeholder="Re-enter password"
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-slate-400 hover:text-slate-600 transition"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {ownerState.error && (
              <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                {ownerState.error}
              </div>
            )}

            <button
              type="submit"
              disabled={ownerPending}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50 min-h-[44px]"
            >
              {ownerPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </form>
        )}

        {/* Step 3: Email Verification */}
        {currentStep === "otp" && (
          <form
            action={otpAction}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          >
            <input type="hidden" name="shopCode" value={shopState.shopCode || ""} />
            <input type="hidden" name="loginId" value={ownerState.loginId || otpState.loginId || ""} />
            <input type="hidden" name="email" value={otpState.email || ""} />

            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-5 w-5 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900">Verify your email</h2>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">A verification code was sent to</p>
              <p className="text-lg font-black text-slate-900 font-mono tracking-wider">
                {otpState.maskedEmail || "***@***.com"}
              </p>
            </div>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">Verification Code</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-slate-900">
                <ShieldCheck className="h-4 w-4 text-slate-400" />
                <input
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="one-time-code"
                  placeholder="000000"
                  required
                  className="w-full bg-transparent text-sm font-black text-slate-900 outline-none tracking-[0.3em] font-mono min-h-[44px]"
                />
              </div>
            </label>

            {otpState.error && (
              <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                {otpState.error}
              </div>
            )}

            <button
              type="submit"
              disabled={otpPending}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50 min-h-[44px]"
            >
              {otpPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                </span>
              ) : (
                "Verify & Activate"
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0}
                className="text-xs font-bold text-sky-600 hover:text-sky-700 disabled:text-slate-400 disabled:cursor-not-allowed transition"
              >
                {resendCooldown > 0
                  ? `Resend OTP in ${resendCooldown}s`
                  : "Resend OTP"}
              </button>
            </div>
          </form>
        )}

        {/* Success */}
        {currentStep === "success" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm space-y-4 text-center">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
            <h2 className="text-lg font-black text-emerald-900">Account Created!</h2>
            <p className="text-sm text-emerald-700">
              Your shop is ready. Redirecting to your dashboard...
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white shadow-xs transition hover:bg-emerald-700 min-h-[44px]"
            >
              Go to Dashboard
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
