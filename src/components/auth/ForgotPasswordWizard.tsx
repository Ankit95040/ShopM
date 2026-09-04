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

function AuthBrandedPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 xl:w-[45%] bg-slate-900 relative overflow-hidden">
      <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
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
        <div className="py-12">
          <h1 className="text-4xl xl:text-5xl font-black leading-[1.1] tracking-tight text-white mb-5">
            Secure
            <br />
            <span className="text-sky-400">account recovery.</span>
          </h1>
          <p className="text-base text-slate-400 leading-relaxed max-w-md">
            We&apos;ll help you reset your password and get back to managing your shop in no time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["OTP Verified", "Secure Reset", "Instant Access"].map((f) => (
            <span key={f} className="inline-flex items-center rounded-full bg-white/5 border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-slate-300">
              {f}
            </span>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="absolute top-20 -right-20 w-64 h-64 rounded-full bg-sky-600/5 blur-3xl" />
    </div>
  );
}

function MobileBrand() {
  return (
    <div className="lg:hidden mb-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 font-extrabold text-white text-xs tracking-tight shadow-md">
          SM
        </div>
        <span className="text-lg font-black tracking-tight text-slate-900">
          Shop<span className="text-sky-600">M</span>
        </span>
      </div>
    </div>
  );
}

function StepIndicator({ steps, currentStep }: { steps: { key: string; label: string; num: string }[]; currentStep: string }) {
  const activeIdx = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const isDone = i < activeIdx;
        const isActive = i === activeIdx;
        return (
          <div key={s.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className={`w-full h-1 rounded-full transition-all duration-300 ${isDone ? "bg-slate-900" : isActive ? "bg-slate-900" : "bg-slate-200"}`} />
              <span className={`text-[10px] font-bold tracking-wider uppercase transition-colors duration-200 ${isDone ? "text-slate-900" : isActive ? "text-slate-900" : "text-slate-400"}`}>
                {s.num} {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
    { key: "shop", label: "Shop", num: "01" },
    { key: "loginId", label: "User", num: "02" },
    { key: "email", label: "Email", num: "03" },
    { key: "otp", label: "Verify", num: "04" },
    { key: "password", label: "Password", num: "05" },
  ];

  return (
    <div className="min-h-screen flex">
      <AuthBrandedPanel />
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-md">
          <MobileBrand />
          <div className="mb-6">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors mb-5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Login
            </Link>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Reset Password
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 font-medium">
              Verify your identity with an OTP sent to your registered email.
            </p>
          </div>

          {/* Step indicator */}
          <div className="mb-6">
            <StepIndicator steps={stepper} currentStep={currentStep} />
          </div>

          {/* Step 1: Shop Code */}
          {currentStep === "shop" && (
            <form
              action={step1Action}
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm space-y-4"
            >
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                  <Store className="h-4 w-4 text-slate-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Enter your Shop ID</h3>
              </div>

              <label className="block">
                <span className="text-xs font-bold text-slate-700">Shop ID</span>
                <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                  <Store className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    name="shopCode"
                    type="text"
                    autoComplete="organization"
                    required
                    placeholder="e.g. SHARMA-STORE"
                    className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 min-h-[44px]"
                  />
                </div>
              </label>

              {step1State.error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700 animate-in fade-in slide-in-from-top-1 duration-200">
                  {step1State.error}
                </div>
              )}

              <button
                type="submit"
                disabled={step1Pending}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md active:scale-[0.98] disabled:opacity-50 min-h-[48px]"
              >
                {step1Pending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Checking...
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
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm space-y-4"
            >
              <input type="hidden" name="shopCode" value={step1State.shopCode || ""} />

              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                  <UserRound className="h-4 w-4 text-slate-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Enter your Login ID</h3>
              </div>

              <label className="block">
                <span className="text-xs font-bold text-slate-700">Login ID</span>
                <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                  <UserRound className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    name="loginId"
                    type="text"
                    autoComplete="username"
                    required
                    placeholder="e.g. rahul"
                    className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 min-h-[44px]"
                  />
                </div>
              </label>

              {step2State.error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700 animate-in fade-in slide-in-from-top-1 duration-200">
                  {step2State.error}
                </div>
              )}

              <button
                type="submit"
                disabled={step2Pending}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md active:scale-[0.98] disabled:opacity-50 min-h-[48px]"
              >
                {step2Pending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...
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
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm space-y-4"
            >
              <input type="hidden" name="shopCode" value={step1State.shopCode || ""} />
              <input type="hidden" name="loginId" value={step2State.loginId || ""} />
              <input type="hidden" name="email" value={otpState.email || ""} />

              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                  <Mail className="h-4 w-4 text-slate-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Verify your email address</h3>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">An OTP will be sent to</p>
                <p className="text-base font-black text-slate-900 font-mono tracking-wider">
                  {otpState.maskedEmail || "***@***.com"}
                </p>
              </div>

              {otpState.error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700 animate-in fade-in slide-in-from-top-1 duration-200">
                  {otpState.error}
                </div>
              )}

              <button
                type="submit"
                disabled={otpPending}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md active:scale-[0.98] disabled:opacity-50 min-h-[48px]"
              >
                {otpPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending OTP...
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
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm space-y-4"
            >
              <input type="hidden" name="shopCode" value={step1State.shopCode || ""} />
              <input type="hidden" name="loginId" value={step2State.loginId || ""} />
              <input type="hidden" name="email" value={otpState.email || verifyState.email || ""} />

              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                  <ShieldCheck className="h-4 w-4 text-slate-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Enter verification code</h3>
              </div>

              <p className="text-xs text-slate-500">
                Enter the 6-digit code sent to <span className="font-bold text-slate-700">{otpState.maskedEmail || verifyState.maskedEmail}</span>
              </p>

              <label className="block">
                <span className="text-xs font-bold text-slate-700">OTP Code</span>
                <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                  <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    placeholder="000000"
                    required
                    className="w-full bg-transparent text-base sm:text-sm font-black text-slate-900 outline-none tracking-[0.3em] font-mono min-h-[44px]"
                  />
                </div>
              </label>

              {verifyState.error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700 animate-in fade-in slide-in-from-top-1 duration-200">
                  {verifyState.error}
                </div>
              )}

              <button
                type="submit"
                disabled={verifyPending}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md active:scale-[0.98] disabled:opacity-50 min-h-[48px]"
              >
                {verifyPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...
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
                  className="text-xs font-bold text-sky-600 hover:text-sky-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
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
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm space-y-4"
            >
              <input type="hidden" name="shopCode" value={step1State.shopCode || ""} />
              <input type="hidden" name="loginId" value={step2State.loginId || ""} />
              <input type="hidden" name="email" value={verifyState.email || ""} />

              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                  <KeyRound className="h-4 w-4 text-slate-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Set your new password</h3>
              </div>

              <label className="block">
                <span className="text-xs font-bold text-slate-700">New Password</span>
                <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                  <KeyRound className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    name="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={6}
                    required
                    className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 min-h-[44px]"
                    placeholder="Min. 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-slate-700">Confirm Password</span>
                <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                  <KeyRound className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={6}
                    required
                    className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 min-h-[44px]"
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              {resetState.error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700 animate-in fade-in slide-in-from-top-1 duration-200">
                  {resetState.error}
                </div>
              )}

              <button
                type="submit"
                disabled={resetPending}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md active:scale-[0.98] disabled:opacity-50 min-h-[48px]"
              >
                {resetPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Resetting...
                  </span>
                ) : (
                  "Reset Password"
                )}
              </button>
            </form>
          )}

          {/* Success */}
          {currentStep === "success" && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-7 shadow-sm space-y-4 text-center">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
              </div>
              <h3 className="text-lg font-black text-emerald-900">Password Reset Successful</h3>
              <p className="text-sm text-emerald-700">
                Your password has been updated. All previous sessions have been signed out.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white shadow-sm transition-all duration-200 hover:bg-emerald-700 min-h-[48px]"
              >
                Go to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}