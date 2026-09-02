"use client";

import { useActionState, useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
  forgotPasswordStep1,
  forgotPasswordStep2,
  sendOtpAction,
  verifyOtpAction,
  resetPasswordAction,
  type OtpActionState,
} from "@/server/actions/otp.actions";

const initialStep1: OtpActionState = { step: "shop" };

export function ForgotPasswordWizard() {
  const [step1State, step1Action, step1Pending] = useActionState(forgotPasswordStep1, initialStep1);
  const [step2State, step2Action, step2Pending] = useActionState(forgotPasswordStep2, step1State);
  const [otpState, otpAction, otpPending] = useActionState(sendOtpAction, step2State);
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyOtpAction, otpState);
  const [resetState, resetAction, resetPending] = useActionState(resetPasswordAction, verifyState);

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const currentStep = resetState.step || verifyState.step || otpState.step || step2State.step || step1State.step;

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResendOtp = useCallback(async () => {
    if (resendCooldown > 0) return;
    const form = new FormData();
    form.set("shopCode", step1State.shopCode || "");
    form.set("loginId", step2State.loginId || "");
    form.set("email", otpState.email || verifyState.email || "");
    await sendOtpAction(otpState, form);
    setResendCooldown(60);
  }, [resendCooldown, step1State.shopCode, step2State.loginId, otpState, verifyState.email]);

  const stepper = [
    { key: "shop", label: "Shop" },
    { key: "loginId", label: "User" },
    { key: "email", label: "Email" },
    { key: "otp", label: "Verify" },
    { key: "password", label: "Password" },
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
            Reset Password
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Verify your identity with an OTP sent to your registered email.
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

        {/* Step 1: Shop Code */}
        {currentStep === "shop" && (
          <form
            action={step1Action}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Store className="h-5 w-5 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900">Enter your Shop ID</h2>
            </div>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">Shop ID</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-slate-900">
                <Store className="h-4 w-4 text-slate-400" />
                <input
                  name="shopCode"
                  type="text"
                  autoComplete="organization"
                  required
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none min-h-[44px]"
                />
              </div>
            </label>

            {step1State.error && (
              <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                {step1State.error}
              </div>
            )}

            <button
              type="submit"
              disabled={step1Pending}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50 min-h-[44px]"
            >
              {step1Pending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking...
                </span>
              ) : (
                "Continue"
              )}
            </button>
          </form>
        )}

        {/* Step 2: Login ID */}
        {currentStep === "loginId" && (
          <form
            action={step2Action}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          >
            <input type="hidden" name="shopCode" value={step1State.shopCode || ""} />

            <div className="flex items-center gap-2 mb-2">
              <UserRound className="h-5 w-5 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900">Enter your Login ID</h2>
            </div>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">Login ID</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-slate-900">
                <UserRound className="h-4 w-4 text-slate-400" />
                <input
                  name="loginId"
                  type="text"
                  autoComplete="username"
                  required
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none min-h-[44px]"
                />
              </div>
            </label>

            {step2State.error && (
              <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                {step2State.error}
              </div>
            )}

            <button
              type="submit"
              disabled={step2Pending}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50 min-h-[44px]"
            >
              {step2Pending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                </span>
              ) : (
                "Continue"
              )}
            </button>
          </form>
        )}

        {/* Step 3: Email Confirmation + Send OTP */}
        {currentStep === "email" && (
          <form
            action={otpAction}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          >
            <input type="hidden" name="shopCode" value={step1State.shopCode || ""} />
            <input type="hidden" name="loginId" value={step2State.loginId || ""} />
            <input type="hidden" name="email" value={otpState.email || ""} />

            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-5 w-5 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900">Verify your email address</h2>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">An OTP will be sent to</p>
              <p className="text-lg font-black text-slate-900 font-mono tracking-wider">
                {otpState.maskedEmail || "***@***.com"}
              </p>
            </div>

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
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending OTP...
                </span>
              ) : (
                "Send OTP"
              )}
            </button>
          </form>
        )}

        {/* Step 4: OTP Verification */}
        {currentStep === "otp" && (
          <form
            action={verifyAction}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          >
            <input type="hidden" name="shopCode" value={step1State.shopCode || ""} />
            <input type="hidden" name="loginId" value={step2State.loginId || ""} />
            <input type="hidden" name="email" value={otpState.email || verifyState.email || ""} />

            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-5 w-5 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900">Enter verification code</h2>
            </div>

            <p className="text-xs text-slate-500">
              Enter the {6}-digit code sent to <span className="font-bold text-slate-700">{otpState.maskedEmail || verifyState.maskedEmail}</span>
            </p>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">OTP Code</span>
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

            {verifyState.error && (
              <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                {verifyState.error}
              </div>
            )}

            <button
              type="submit"
              disabled={verifyPending}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50 min-h-[44px]"
            >
              {verifyPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                </span>
              ) : (
                "Verify OTP"
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

        {/* Step 5: Set New Password */}
        {currentStep === "password" && (
          <form
            action={resetAction}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          >
            <input type="hidden" name="shopCode" value={step1State.shopCode || ""} />
            <input type="hidden" name="loginId" value={step2State.loginId || ""} />
            <input type="hidden" name="email" value={verifyState.email || ""} />

            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="h-5 w-5 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900">Set your new password</h2>
            </div>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">New Password</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-slate-900">
                <KeyRound className="h-4 w-4 text-slate-400" />
                <input
                  name="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={6}
                  required
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none min-h-[44px]"
                  placeholder="Min. 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="text-slate-400 hover:text-slate-600 transition"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none min-h-[44px]"
                  placeholder="Re-enter password"
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

            {resetState.error && (
              <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                {resetState.error}
              </div>
            )}

            <button
              type="submit"
              disabled={resetPending}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50 min-h-[44px]"
            >
              {resetPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Resetting...
                </span>
              ) : (
                "Reset Password"
              )}
            </button>
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
            <h2 className="text-lg font-black text-emerald-900">Password Reset Successful</h2>
            <p className="text-sm text-emerald-700">
              Your password has been updated. All previous sessions have been signed out.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white shadow-xs transition hover:bg-emerald-700 min-h-[44px]"
            >
              Go to Login
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
