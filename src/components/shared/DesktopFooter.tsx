"use client";

import { MessageCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface DesktopFooterProps {
  onOpenFeedback: () => void;
}

export function DesktopFooter({ onOpenFeedback }: DesktopFooterProps) {
  const { t } = useTranslation();

  return (
    <footer className="hidden sm:block border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          {/* Left: Branding + Version */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-black tracking-widest text-white shadow-xs">
              SM
            </div>
            <span className="text-sm font-black tracking-tight text-slate-900">
              Shop<span className="text-sky-600">M</span>
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-xs font-medium text-slate-500">{t("footerVersion")}</span>
          </div>

          {/* Center: Help & Feedback */}
          <button
            onClick={onOpenFeedback}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-sky-50 hover:text-sky-700"
          >
            <MessageCircle className="h-3.5 w-3.5 text-sky-600" />
            {t("helpAndFeedback")}
          </button>

          {/* Right: Copyright */}
          <div className="text-xs font-medium text-slate-400">
            © {new Date().getFullYear()} ShopM. {t("footerRights")}
          </div>
        </div>
      </div>
    </footer>
  );
}
