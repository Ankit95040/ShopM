"use client";

/* eslint-disable react-hooks/set-state-in-effect */

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
  Eye,
  EyeOff,
  Users,
  Ticket,
} from "lucide-react";
import {
  registerValidateShopAction,
  registerCreateOwnerAction,
  registerValidateJoinAction,
  registerCreateJoinMemberAction,
  verifyRegistrationOtpAction,
  resendRegistrationOtpAction,
  type RegisterActionState,
} from "@/server/actions/register.actions";

const initialShopState: RegisterActionState = { step: "shop" };

type Mode = "choice" | "create" | "join";

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
            Start managing
            <br />
            <span className="text-sky-400">your shop today.</span>
          </h1>
          <p className="text-base text-slate-400 leading-relaxed max-w-md">
            Create your shop, invite your team, and take control of billing, inventory and customer ledgers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["Free to Start", "No Credit Card", "Instant Setup"].map((f) => (
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

function StepIndicator({ steps, currentStep, isComplete }: { steps: { key: string; label: string; num: string }[]; currentStep: string; isComplete: boolean }) {
  const activeIdx = isComplete ? steps.length : steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const isActive = i === activeIdx;
        const isDone = i < activeIdx || isComplete;
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

export function RegisterWizard() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choice");

  const [shopState, shopAction, shopPending] = useActionState(registerValidateShopAction, initialShopState);
  const [ownerState, ownerAction, ownerPending] = useActionState(registerCreateOwnerAction, initialShopState);
  const [joinShopState, joinShopAction, joinShopPending] = useActionState(registerValidateJoinAction, initialShopState);
  const [joinOwnerState, joinOwnerAction, joinOwnerPending] = useActionState(registerCreateJoinMemberAction, initialShopState);
  const [otpState, otpAction, otpPending] = useActionState(verifyRegistrationOtpAction, initialShopState);
  const [resendState, resendAction] = useActionState(resendRegistrationOtpAction, initialShopState);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [shopNameInput, setShopNameInput] = useState("");
  const [shopCodeInput, setShopCodeInput] = useState("");
  const [invitationCodeInput, setInvitationCodeInput] = useState("");
  const [userNameInput, setUserNameInput] = useState("");
  const [loginIdInput, setLoginIdInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [otpInputValue, setOtpInputValue] = useState("");

  const getStepPriority = (s: RegisterActionState["step"]) => {
    if (s === "success") return 3;
    if (s === "otp") return 2;
    if (s === "owner") return 1;
    return 0;
  };

  const createCurrentStep = [shopState.step, ownerState.step, otpState.step, resendState.step].reduce(
    (best, cur) => (getStepPriority(cur) > getStepPriority(best) ? cur : best),
    "shop" as RegisterActionState["step"]
  );
  const joinCurrentStep = [joinShopState.step, joinOwnerState.step, otpState.step, resendState.step].reduce(
    (best, cur) => (getStepPriority(cur) > getStepPriority(best) ? cur : best),
    "shop" as RegisterActionState["step"]
  );
  const currentStep = mode === "join" ? joinCurrentStep : mode === "create" ? createCurrentStep : "shop";

  useEffect(() => {
    if (shopState.step === "owner" && mode === "choice") setMode("create");
  }, [shopState.step, mode]);
  useEffect(() => {
    if (joinShopState.step === "owner" && mode === "choice") setMode("join");
  }, [joinShopState.step, mode]);
  useEffect(() => {
    if (ownerState.step === "otp" && mode !== "join") setMode("create");
  }, [ownerState.step, mode]);
  useEffect(() => {
    if (joinOwnerState.step === "otp") setMode("join");
  }, [joinOwnerState.step]);

  const effectiveMode: Mode = (() => {
    if (joinOwnerState.step === "otp" || joinShopState.step === "owner" || otpState.invitationCode || joinShopState.invitationCode || joinOwnerState.invitationCode) return "join";
    if (shopState.step === "owner" || ownerState.step === "otp") return "create";
    return mode;
  })();

  const isJoinMode = effectiveMode === "join";
  const displayMode = effectiveMode === "choice" ? "choice" : effectiveMode;

  const otpEmail = otpState.email || resendState.email || ownerState.email || joinOwnerState.email || "";
  const otpShopCode = otpState.shopCode || resendState.shopCode || shopState.shopCode || joinShopState.shopCode || ownerState.shopCode || joinOwnerState.shopCode || "";
  const otpLoginId = otpState.loginId || resendState.loginId || ownerState.loginId || joinOwnerState.loginId || "";
  const otpInvitationCode = otpState.invitationCode || resendState.invitationCode || joinOwnerState.invitationCode || joinShopState.invitationCode || "";
  const displayMaskedEmail = otpState.maskedEmail || resendState.maskedEmail || ownerState.maskedEmail || joinOwnerState.maskedEmail || "***@***.com";
  const otpError = otpState.error || resendState.error;

  useEffect(() => {
    const stepForSuccess = effectiveMode === "join" ? joinCurrentStep : createCurrentStep;
    if (stepForSuccess === "success" || otpState.step === "success" || resendState.step === "success") {
      const timer = setTimeout(() => router.push("/"), 1500);
      return () => clearTimeout(timer);
    }
  }, [createCurrentStep, joinCurrentStep, otpState.step, resendState.step, router, effectiveMode]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResendOtp = useCallback(async () => {
    if (resendCooldown > 0) return;
    const form = new FormData();
    form.set("shopCode", otpShopCode);
    form.set("loginId", otpLoginId);
    form.set("email", otpEmail);
    if (otpInvitationCode) form.set("invitationCode", otpInvitationCode);
    await resendAction(form);
    setResendCooldown(60);
  }, [resendCooldown, otpShopCode, otpLoginId, otpEmail, otpInvitationCode, resendAction]);

  const stepper = [
    { key: "shop", label: "Shop", num: "01" },
    { key: "owner", label: "Account", num: "02" },
    { key: "otp", label: "Verify", num: "03" },
  ];

  // Choice screen
  if (displayMode === "choice" && currentStep === "shop" && shopState.step === "shop" && joinShopState.step === "shop") {
    return (
      <div className="min-h-screen flex">
        <AuthBrandedPanel />
        <div className="flex-1 flex items-center justify-center bg-slate-50 px-4 py-10 sm:px-6 sm:py-12">
          <div className="w-full max-w-md">
            <MobileBrand />
            <div className="mb-8">
              <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors mb-5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
              </Link>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Get started with ShopM
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 font-medium">
                Choose how you want to set up your shop.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm space-y-3">
              <button
                onClick={() => setMode("create")}
                className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-black text-white shadow-sm hover:bg-slate-800 hover:shadow-md transition-all duration-200 active:scale-[0.98] min-h-[48px] flex items-center justify-center gap-2.5"
              >
                <Store className="h-4 w-4" /> Create New Shop
              </button>
              <button
                onClick={() => setMode("join")}
                className="w-full rounded-xl border border-slate-300 bg-white py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 active:scale-[0.98] min-h-[48px] flex items-center justify-center gap-2.5"
              >
                <Users className="h-4 w-4" /> Join Existing Shop
              </button>
              <div className="text-center pt-3">
                <Link href="/login" className="text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors">
                  Already have an account? Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeShopState = isJoinMode ? joinShopState : shopState;
  const activeShopAction = isJoinMode ? joinShopAction : shopAction;
  const activeShopPending = isJoinMode ? joinShopPending : shopPending;
  const activeOwnerState = isJoinMode ? joinOwnerState : ownerState;
  const activeOwnerAction = isJoinMode ? joinOwnerAction : ownerAction;
  const activeOwnerPending = isJoinMode ? joinOwnerPending : ownerPending;
  const activeCurrentStep = isJoinMode ? joinCurrentStep : createCurrentStep;

  const finalCurrentStep = otpState.step === "success" || resendState.step === "success" ? "success" : activeCurrentStep === "otp" || otpState.step === "otp" || resendState.step === "otp" ? "otp" : activeCurrentStep;

  return (
    <div className="min-h-screen flex">
      <AuthBrandedPanel />
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-md">
          <MobileBrand />
          <div className="mb-6">
            <button onClick={() => setMode("choice")} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors mb-5">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              {isJoinMode ? "Join Existing Shop" : "Create your Shop"}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 font-medium">
              {isJoinMode ? "Enter your Shop ID and invitation code to join." : "Set up your shop and start managing your business."}
            </p>
          </div>

          {/* Step indicator */}
          <div className="mb-6">
            <StepIndicator steps={stepper} currentStep={finalCurrentStep} isComplete={finalCurrentStep === "success"} />
          </div>

          {finalCurrentStep === "shop" && (
            <form action={activeShopAction} className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                  <Store className="h-4 w-4 text-slate-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">{isJoinMode ? "Join Shop" : "Shop Details"}</h3>
              </div>
              {!isJoinMode ? (
                <>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Shop Name</span>
                    <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                      <Store className="h-4 w-4 text-slate-400 shrink-0" />
                      <input name="shopName" type="text" placeholder="e.g. Sharma Building Materials" required value={shopNameInput} onChange={(e) => setShopNameInput(e.target.value)} className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 min-h-[44px]" />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Shop ID</span>
                    <p className="mt-0.5 text-[11px] text-slate-400 font-medium">This is the unique ID you will use to log in.</p>
                    <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                      <Store className="h-4 w-4 text-slate-400 shrink-0" />
                      <input name="shopCode" type="text" placeholder="e.g. SHARMA-BUILDERS" required value={shopCodeInput} onChange={(e) => setShopCodeInput(e.target.value)} className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 min-h-[44px]" />
                    </div>
                  </label>
                </>
              ) : (
                <>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Shop ID</span>
                    <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                      <Store className="h-4 w-4 text-slate-400 shrink-0" />
                      <input name="shopCode" type="text" placeholder="e.g. SHARMA-STORE" required value={shopCodeInput} onChange={(e) => setShopCodeInput(e.target.value)} className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 min-h-[44px]" />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Invitation Code</span>
                    <p className="mt-0.5 text-[11px] text-slate-400 font-medium">Ask your shop owner for the invitation code.</p>
                    <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                      <Ticket className="h-4 w-4 text-slate-400 shrink-0" />
                      <input name="invitationCode" type="text" placeholder="e.g. A1B2C3D4" required value={invitationCodeInput} onChange={(e) => setInvitationCodeInput(e.target.value.toUpperCase())} className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 min-h-[44px] font-mono tracking-wider" />
                    </div>
                  </label>
                </>
              )}
              {activeShopState.error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700 animate-in fade-in slide-in-from-top-1 duration-200">
                  {activeShopState.error}
                </div>
              )}
              <button type="submit" disabled={activeShopPending} className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800 hover:shadow-md transition-all duration-200 active:scale-[0.98] disabled:opacity-50 min-h-[48px]">
                {activeShopPending ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Checking...</span> : "Continue"}
              </button>
            </form>
          )}

          {finalCurrentStep === "owner" && (
            <form action={activeOwnerAction} className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm space-y-4">
              <input type="hidden" name="shopCode" value={activeShopState.shopCode || shopCodeInput} />
              {!isJoinMode && <input type="hidden" name="shopName" value={activeShopState.shopName || shopNameInput} />}
              {isJoinMode && <input type="hidden" name="invitationCode" value={activeShopState.invitationCode || invitationCodeInput} />}
              {isJoinMode && <input type="hidden" name="shopName" value={activeShopState.shopName || ""} />}

              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                  <UserRound className="h-4 w-4 text-slate-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">{isJoinMode ? "Your Account" : "Owner Account"}</h3>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5 text-xs text-slate-600 font-medium">
                {isJoinMode ? "Joining shop:" : "Creating shop:"} <span className="font-bold text-slate-900">{activeShopState.shopName || shopNameInput || activeShopState.shopCode || shopCodeInput}</span> <span className="font-mono text-slate-500">({activeShopState.shopCode || shopCodeInput})</span>
                {isJoinMode && <span className="block mt-1.5 text-[11px] text-slate-500">You will be added as <strong className="text-slate-700">EMPLOYEE</strong> (owner can promote later).</span>}
              </div>

              <label className="block">
                <span className="text-xs font-bold text-slate-700">Full Name</span>
                <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                  <UserRound className="h-4 w-4 text-slate-400 shrink-0" />
                  <input name="userName" type="text" autoComplete="name" placeholder="e.g. Rahul Sharma" required value={userNameInput} onChange={(e) => setUserNameInput(e.target.value)} className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 min-h-[44px]" />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-700">User ID</span>
                <p className="mt-0.5 text-[11px] text-slate-400 font-medium">Your personal login ID for this shop.</p>
                <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                  <UserRound className="h-4 w-4 text-slate-400 shrink-0" />
                  <input name="loginId" type="text" autoComplete="username" placeholder="e.g. rahul" required value={loginIdInput} onChange={(e) => setLoginIdInput(e.target.value)} className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 min-h-[44px]" />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-700">Email</span>
                <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                  <input name="email" type="email" autoComplete="email" placeholder="rahul@example.com" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 min-h-[44px]" />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-700">Password</span>
                <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                  <KeyRound className="h-4 w-4 text-slate-400 shrink-0" />
                  <input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={6} required placeholder="Min. 6 characters" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 min-h-[44px]" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0" tabIndex={-1}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-700">Confirm Password</span>
                <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                  <KeyRound className="h-4 w-4 text-slate-400 shrink-0" />
                  <input name="confirmPassword" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" minLength={6} required placeholder="Re-enter password" value={confirmPasswordInput} onChange={(e) => setConfirmPasswordInput(e.target.value)} className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 min-h-[44px]" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0" tabIndex={-1}>{showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
              </label>
              {activeOwnerState.error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700 animate-in fade-in slide-in-from-top-1 duration-200">
                  {activeOwnerState.error}
                </div>
              )}
              <button type="submit" disabled={activeOwnerPending} className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800 hover:shadow-md transition-all duration-200 active:scale-[0.98] disabled:opacity-50 min-h-[48px]">
                {activeOwnerPending ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating account...</span> : "Create Account"}
              </button>
            </form>
          )}

          {finalCurrentStep === "otp" && (
            <form action={otpAction} className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm space-y-4">
              <input type="hidden" name="shopCode" value={otpShopCode} />
              <input type="hidden" name="loginId" value={otpLoginId} />
              <input type="hidden" name="email" value={otpEmail} />
              {otpInvitationCode && <input type="hidden" name="invitationCode" value={otpInvitationCode} />}
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                  <ShieldCheck className="h-4 w-4 text-slate-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Verify your email</h3>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">A verification code was sent to</p>
                <p className="text-base font-black text-slate-900 font-mono tracking-wider">{displayMaskedEmail}</p>
              </div>
              <label className="block">
                <span className="text-xs font-bold text-slate-700">Verification Code</span>
                <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all duration-200">
                  <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0" />
                  <input name="otp" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="one-time-code" placeholder="000000" required value={otpInputValue} onChange={(e) => setOtpInputValue(e.target.value)} className="w-full bg-transparent text-base sm:text-sm font-black text-slate-900 outline-none tracking-[0.3em] font-mono min-h-[44px]" />
                </div>
              </label>
              {otpError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700 animate-in fade-in slide-in-from-top-1 duration-200">
                  {otpError}
                </div>
              )}
              <button type="submit" disabled={otpPending} className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800 hover:shadow-md transition-all duration-200 active:scale-[0.98] disabled:opacity-50 min-h-[48px]">
                {otpPending ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...</span> : "Verify & Activate"}
              </button>
              <div className="text-center">
                <button type="button" onClick={handleResendOtp} disabled={resendCooldown > 0} className="text-xs font-bold text-sky-600 hover:text-sky-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors">
                  {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
                </button>
              </div>
            </form>
          )}

          {finalCurrentStep === "success" && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-7 shadow-sm space-y-4 text-center">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
              </div>
              <h3 className="text-lg font-black text-emerald-900">Account Created!</h3>
              <p className="text-sm text-emerald-700">Your shop is ready. Redirecting to your dashboard...</p>
              <Link href="/" className="inline-flex items-center justify-center w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700 transition-all duration-200 min-h-[48px]">Go to Dashboard</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}