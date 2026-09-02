"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Store,
  Receipt,
  Boxes,
  BarChart3,
  ShieldAlert,
  Trash2,
  User,
  Languages,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation, TranslationKey } from "@/lib/i18n";
import { logoutAction } from "@/server/actions/auth.actions";

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

function cleanDisplayName(name: string | null | undefined): string {
  if (!name) return "";
  return name.replace(/\(.*?\)/g, "").trim();
}

export function Navbar({
  userName,
  role,
}: {
  userName?: string | null;
  role?: string | null;
}) {
  const pathname = usePathname();
  const { language, toggleLanguage, t } = useTranslation();
  const displayName = cleanDisplayName(userName);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur shadow-xs">
      <div className="flex h-16 items-center px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Brand Logo - left */}
        <Link href="/" className="flex shrink-0 items-center gap-2 mr-3 sm:mr-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 font-extrabold text-white shadow-md text-sm">
            SM
          </div>
          <span className="text-lg font-black tracking-tight text-slate-900 whitespace-nowrap hidden sm:inline">
            Shop<span className="text-sky-600">M</span>
          </span>
        </Link>

        {/* Navigation Tabs - center, clean horizontal baseline */}
        <nav className="hidden lg:flex flex-1 items-center justify-center gap-1">
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
                  "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-sm font-bold leading-none transition-colors",
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-sky-400" : "text-slate-500")} />
                <span className="whitespace-nowrap">{t(item.key)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Tablet nav - compact */}
        <nav className="hidden sm:flex lg:hidden flex-1 items-center justify-center gap-1">
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
                  "inline-flex h-9 items-center justify-center gap-1 whitespace-nowrap rounded-xl px-2.5 text-xs font-bold leading-none transition-colors",
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
                title={t(item.key)}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-sky-400" : "text-slate-500")} />
                <span className="whitespace-nowrap hidden xl:inline">{t(item.key)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Section: Language Toggle + Recycle Bin Icon + User Badge */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 ml-auto">
          {/* Recycle Bin Icon Button */}
          <Link
            href="/recycle-bin"
            title={t("recycleBinNav")}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-full transition",
              pathname === "/recycle-bin"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Trash2 className="h-4 w-4" />
          </Link>

          {/* Language Switcher Pill */}
          <button
            onClick={toggleLanguage}
            title={language === "en" ? "Switch to Hindi (\u0939\u093F\u0902\u0926\u0940)" : "Switch to English"}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-slate-300 bg-slate-50 px-2.5 sm:px-3 text-xs font-bold leading-none text-slate-800 hover:bg-slate-100 hover:border-slate-400 transition active:scale-95 shadow-2xs"
          >
            <Languages className="h-3.5 w-3.5 shrink-0 text-sky-600" />
            <span className="text-[11px] uppercase tracking-wider whitespace-nowrap">
              {language === "en" ? "\u0939\u093F\u0902\u0926\u0940" : "English"}
            </span>
          </button>

          {displayName && (
            <>
              <div className="hidden md:inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full bg-slate-100 px-3 border border-slate-200">
                <User className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                <span className="text-xs font-semibold leading-none text-slate-800 whitespace-nowrap">
                  {displayName}
                  {role ? (
                    <span className="ml-1.5 inline-flex items-center rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold leading-none text-sky-700 uppercase tracking-wider">
                      {role}
                    </span>
                  ) : null}
                </span>
              </div>

              <form action={logoutAction} className="shrink-0">
                <button
                  type="submit"
                  title="Logout"
                  className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-red-200 bg-white px-2.5 sm:px-3 text-xs font-bold leading-none text-red-600 hover:bg-red-50 hover:border-red-300 transition"
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0 text-red-400" />
                  <span className="hidden sm:inline whitespace-nowrap">Logout</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <div className="flex sm:hidden items-center justify-around gap-1 border-t border-slate-100 bg-slate-50 px-2 py-1.5">
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
                "inline-flex flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-[10px] font-bold leading-none min-w-0 flex-1",
                isActive ? "text-sky-600 font-black" : "text-slate-600"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap leading-none truncate">{t(item.key)}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
