"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Store,
  Receipt,
  Boxes,
  BarChart3,
  ShieldAlert,
  User,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation, TranslationKey } from "@/lib/i18n";

interface NavItemConfig {
  key: TranslationKey;
  href: string;
  icon: typeof Store;
}

const NAV_ITEMS: NavItemConfig[] = [
  { key: "dashboard", href: "/", icon: Store },
  { key: "billingNav", href: "/billing", icon: Receipt },
  { key: "inventoryNav", href: "/inventory", icon: Boxes },
  { key: "reportsNav", href: "/reports", icon: BarChart3 },
  { key: "auditLogsNav", href: "/audit-logs", icon: ShieldAlert },
];

export function Navbar({
  userName = "Ankit Raj",
}: {
  userName?: string;
}) {
  const pathname = usePathname();
  const { language, setLanguage, toggleLanguage, t } = useTranslation();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur shadow-xs">
      <div className="flex h-16 items-center justify-between px-4 sm:px-8 max-w-7xl mx-auto gap-3">
        {/* Brand Logo */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 font-extrabold text-white shadow-md">
              SM
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-slate-900">
                Shop<span className="text-sky-600">M</span>
              </span>
              <span className="block text-[10px] font-semibold text-slate-400 -mt-1 tracking-wider uppercase">
                {t("appTagline")}
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden sm:flex items-center gap-1 sm:gap-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-all",
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-sky-400" : "text-slate-500")} />
                <span>{t(item.key)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Section: Language Toggle + User Badge */}
        <div className="flex items-center gap-2.5">
          {/* Language Switcher Pill */}
          <button
            onClick={toggleLanguage}
            title={language === "en" ? "Switch to Hindi (हिंदी)" : "Switch to English"}
            className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 hover:border-slate-400 transition active:scale-95 shadow-2xs"
          >
            <Languages className="h-3.5 w-3.5 text-sky-600" />
            <span className="text-[11px] uppercase tracking-wider">
              {language === "en" ? "🇮🇳 हिंदी" : "🇬🇧 English"}
            </span>
          </button>

          {/* User Session Info */}
          <div className="hidden md:flex items-center gap-2 rounded-full bg-slate-100 py-1.5 px-3.5 border border-slate-200">
            <User className="h-3.5 w-3.5 text-slate-600" />
            <span className="text-xs font-semibold text-slate-800">{userName}</span>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <div className="flex sm:hidden border-t border-slate-100 px-2 py-1.5 justify-around bg-slate-50 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1 text-[10px] font-bold whitespace-nowrap",
                isActive ? "text-sky-600 font-black" : "text-slate-600"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t(item.key)}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
