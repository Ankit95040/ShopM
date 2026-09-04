"use client";

import { MessageCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface DesktopFooterProps {
  onOpenFeedback: () => void;
}

export function DesktopFooter({ onOpenFeedback }: DesktopFooterProps) {
  const { t } = useTranslation();

  return (
    <footer className="block border-t border-blue-900 bg-blue-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          {/* Left: Branding + Version */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[10px] font-black tracking-widest text-blue-900 shadow-xs">
              SM
            </div>
            <span className="text-sm font-black tracking-tight text-white">
              Shop<span className="text-sky-300">M</span>
            </span>
            <span className="text-blue-300">·</span>
            <span className="text-xs font-medium text-blue-100">{t("footerVersion")}</span>
          </div>

          {/* Center: Help & Feedback */}
          <button
            onClick={onOpenFeedback}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            <MessageCircle className="h-3.5 w-3.5 text-sky-200" />
            {t("helpAndFeedback")}
          </button>

          {/* Right: Copyright */}
          <div className="text-xs font-medium text-blue-200">
            © {new Date().getFullYear()} ShopM. {t("footerRights")}
          </div>
        </div>
      </div>
    </footer>
  );
}
