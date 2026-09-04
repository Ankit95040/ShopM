"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Store,
  User,
  Copy,
  Check,
  Share2,
  Mail,
  Phone,
  Shield,
  Trash2,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/shared/ToastContext";
import { getAccountDetailsAction, AccountDetails } from "@/server/actions/auth.actions";
import { DeleteAccountModal } from "@/components/shared/DeleteAccountModal";

interface AccountDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("copyFailed"));
    }
  }, [text, t, toast]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition min-h-[28px]"
      title={label}
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      <span className="whitespace-nowrap">{copied ? t("copied") : t("copy")}</span>
    </button>
  );
}

export function AccountDetailsModal({ isOpen, onClose }: AccountDetailsModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [details, setDetails] = useState<AccountDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || fetchedRef.current) return;
    fetchedRef.current = true;
    setIsLoading(true);
    getAccountDetailsAction()
      .then((data) => {
        setDetails(data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
        toast.error(t("accountDetailsError"));
      });
  }, [isOpen, t, toast]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  const buildShareText = useCallback(() => {
    if (!details) return "";
    const lines = [
      `Shop Name: ${details.shopName}`,
      `Shop ID: ${details.shopCode}`,
      `Name: ${details.userName}`,
      `Login ID: ${details.loginId}`,
      `Role: ${details.role}`,
    ];
    if (details.email) lines.push(`Email: ${details.email}`);
    if (details.phone) lines.push(`Phone: ${details.phone}`);
    return lines.join("\n");
  }, [details]);

  const handleCopyShopId = useCallback(async () => {
    if (!details) return;
    try {
      await navigator.clipboard.writeText(details.shopCode);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }, [details, t, toast]);

  const handleCopyAll = useCallback(async () => {
    const text = buildShareText();
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("shopDetailsCopied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }, [buildShareText, t, toast]);

  const handleShare = useCallback(async () => {
    const text = buildShareText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${details?.shopName} - Shop Details`,
          text,
        });
      } catch {
        // User cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(t("shopDetailsCopied"));
      } catch {
        toast.error(t("copyFailed"));
      }
    }
  }, [buildShareText, details, t, toast]);

  if (!isOpen || typeof window === "undefined") return null;

  const mainPortal = createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-details-title"
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-32px)]"
      >
        {/* Header — mobile compact */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2" id="account-details-title">
            <User className="h-5 w-5 text-sky-600" />
            <h2 className="text-base font-black text-slate-900">{t("accountDetails")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-slate-100 transition shrink-0"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Scrollable body — mobile compact */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="h-6 w-6 border-2 border-slate-300 border-t-sky-600 rounded-full animate-spin" />
                <p className="text-xs text-slate-500 mt-2">{t("loading")}</p>
            </div>
          ) : details ? (
            <>
              {/* SHOP DETAILS — mobile simple, desktop unchanged */}
              <div className="block sm:hidden space-y-3">
                <div>
                  <p className="text-[11px] text-slate-500">{t("shopName")}</p>
                  <p className="text-sm font-bold text-slate-900 break-words">{details.shopName}</p>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-500">{t("shopId")}</p>
                    <p className="text-sm font-bold text-slate-900 font-mono tracking-wider break-all">{details.shopCode}</p>
                  </div>
                  <CopyButton text={details.shopCode} label={t("copyShopId")} />
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-2 mb-2">
                  <Store className="h-4 w-4 text-slate-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{t("shopDetails")}</h3>
                </div>
                <p className="text-[11px] text-slate-500">{t("shopName")}</p>
                <p className="text-sm font-bold text-slate-900">{details.shopName}</p>
              </div>

              {/* SHOP ID — mobile subtle, desktop prominent */}
              <div className="hidden sm:block rounded-xl border-2 border-sky-200 bg-sky-50 p-4">
                <p className="text-[11px] font-bold text-sky-600 uppercase tracking-wider mb-1">{t("shopId")}</p>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xl font-black text-sky-800 font-mono tracking-wider break-all">{details.shopCode}</p>
                  <button
                    type="button"
                    onClick={handleCopyShopId}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 transition min-h-[40px]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {t("copyShopId")}
                  </button>
                </div>
              </div>

              {/* Divider — subtle on mobile */}
              <div className="border-t border-slate-100 sm:border-slate-200" />

              {/* MY ACCOUNT — mobile simple (no Role), desktop unchanged */}
              <div className="block sm:hidden">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">{t("currentAccount")}</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-slate-500">{t("name")}</p>
                    <p className="text-sm font-bold text-slate-900 break-words flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="break-words">{details.userName}</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-slate-500">{t("loginIdLabel")}</p>
                      <p className="text-sm font-bold text-slate-900 font-mono break-all">{details.loginId}</p>
                    </div>
                    <CopyButton text={details.loginId} label={t("copyLoginId")} />
                  </div>
                  {details.email && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-slate-500">{t("email")}</p>
                        <p className="text-sm font-bold text-slate-900 break-all flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="break-all">{details.email}</span>
                        </p>
                      </div>
                      <CopyButton text={details.email} label={t("copyEmail")} />
                    </div>
                  )}
                  {details.phone && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-slate-500">{t("phone")}</p>
                        <p className="text-sm font-bold text-slate-900 break-all flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="break-all">{details.phone}</span>
                        </p>
                      </div>
                      <CopyButton text={details.phone} label={t("copyPhone")} />
                    </div>
                  )}
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-slate-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{t("currentAccount")}</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-slate-500">{t("name")}</p>
                    <p className="text-sm font-bold text-slate-900">{details.userName}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-500">{t("loginIdLabel")}</p>
                      <p className="text-sm font-black text-sky-700 font-mono tracking-wider">{details.loginId}</p>
                    </div>
                    <CopyButton text={details.loginId} label={t("copyLoginId")} />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">{t("roleLabel")}</p>
                    <span className="inline-flex items-center rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-700 uppercase tracking-wider">
                      {details.role}
                    </span>
                  </div>
                  {details.email && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-500">{t("email")}</p>
                          <p className="text-sm font-bold text-slate-900 truncate">{details.email}</p>
                        </div>
                      </div>
                      <CopyButton text={details.email} label={t("copyEmail")} />
                    </div>
                  )}
                  {details.phone && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-500">{t("phone")}</p>
                          <p className="text-sm font-bold text-slate-900 truncate">{details.phone}</p>
                        </div>
                      </div>
                      <CopyButton text={details.phone} label={t("copyPhone")} />
                    </div>
                  )}
                </div>
              </div>

              {/* Danger Zone — Delete Account */}
              {!details.isGuest && (
                <div className="rounded-2xl border-2 border-red-200 bg-red-50/70 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-red-600" />
                    <h4 className="text-xs font-black text-red-700 uppercase tracking-wider">Danger Zone</h4>
                  </div>
                  <p className="text-xs leading-relaxed text-red-700/80">
                    Deleting your account will permanently remove your user login. Your shop and its data will remain for other members.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsDeleteOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-white border-2 border-red-300 px-4 py-2.5 text-xs font-black text-red-600 hover:bg-red-50 hover:border-red-400 transition min-h-[44px]"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-xs text-slate-500">{t("accountDetailsError")}</p>
            </div>
          )}
        </div>

        {/* Footer — mobile compact */}
        {details && (
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-slate-100 shrink-0 flex gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleCopyAll}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white hover:bg-slate-800 transition min-h-[44px]"
            >
              <Copy className="h-3.5 w-3.5" />
              {t("copyShopDetails")}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition min-h-[44px]"
            >
              <Share2 className="h-3.5 w-3.5" />
              {t("share")}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      {mainPortal}
      <DeleteAccountModal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} />
    </>
  );
}
