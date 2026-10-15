"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "next-themes";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { BrandMark } from "./BrandMark";
import type { Language } from "../i18n/dictionaries";
import { useIsClient } from "../lib/useClient";

export function Navbar() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const { user, logout, isLoading } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useIsClient();
  const [open, setOpen] = useState(false);
  // Close the menu whenever the route changes.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }

  const links = [
    { href: "/evaluator", label: t.nav.evaluator },
    ...(user ? [{ href: "/dashboard", label: t.nav.history }] : []),
    { href: "/scholarships", label: t.nav.scholarships },
    { href: "/tips", label: t.nav.tips },
    { href: "/about", label: t.nav.about },
  ];

  const isDark = resolvedTheme === "dark";

  const languageSwitch = (
    <div role="group" aria-label={t.nav.language} className="flex rounded-[3px] border border-white/25 p-0.5">
      {(["id", "en"] as Language[]).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLanguage(lang)}
          aria-pressed={language === lang}
          className={`min-h-7 min-w-9 rounded-[2px] px-2 text-xs font-semibold uppercase tracking-wider ${
            language === lang ? "bg-on-bar text-bar" : "text-on-bar-2 hover:text-on-bar"
          }`}
        >
          {lang}
        </button>
      ))}
    </div>
  );

  const themeButton = mounted ? (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? t.nav.themeToLight : t.nav.themeToDark}
      className="grid size-9 place-items-center rounded-[3px] text-on-bar-2 hover:bg-white/10 hover:text-on-bar"
    >
      {isDark ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
    </button>
  ) : (
    <span className="size-9" />
  );

  return (
    <header className="sticky top-0 z-40 bg-bar text-on-bar">
      <a
        href="#content"
        className="sr-only-focusable absolute left-4 top-2 z-50 rounded-[3px] bg-on-bar px-3 py-2 text-sm font-semibold text-bar"
      >
        {t.nav.skip}
      </a>
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-8 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 py-2" aria-label="EssayMentor AI — home">
          <BrandMark className="h-[22px] w-4 text-on-bar" />
          <span className="text-[15px] font-bold tracking-tight">
            EssayMentor <span className="font-medium text-on-bar-2">AI</span>
          </span>
        </Link>

        <nav aria-label={t.nav.label} className="hidden h-full items-stretch gap-1 lg:flex">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center border-b-2 px-3 text-sm font-medium ${
                  active ? "border-on-bar text-on-bar" : "border-transparent text-on-bar-2 hover:text-on-bar"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            {languageSwitch}
            {themeButton}
          </div>
          {!isLoading && (
            <div className="hidden items-center gap-1 border-l border-white/20 pl-3 lg:flex">
              {user ? (
                <>
                  <span className="max-w-40 truncate px-2 text-sm text-on-bar-2">{user.fullName}</span>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="min-h-9 rounded-[3px] px-3 text-sm font-medium text-on-bar-2 hover:bg-white/10 hover:text-on-bar"
                  >
                    {t.nav.logout}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex min-h-9 items-center rounded-[3px] px-3 text-sm font-medium text-on-bar-2 hover:bg-white/10 hover:text-on-bar"
                  >
                    {t.nav.login}
                  </Link>
                  <Link
                    href="/register"
                    className="flex min-h-9 items-center rounded-[3px] border border-on-bar px-3 text-sm font-semibold text-on-bar hover:bg-on-bar hover:text-bar"
                  >
                    {t.nav.register}
                  </Link>
                </>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t.nav.closeMenu : t.nav.menu}
            className="grid size-10 place-items-center rounded-[3px] hover:bg-white/10 lg:hidden"
          >
            {open ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-white/15 lg:hidden">
          <nav aria-label={t.nav.label} className="mx-auto flex max-w-[1440px] flex-col px-4 py-2 sm:px-6">
            {[{ href: "/", label: t.nav.home }, ...links].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className={`flex min-h-12 items-center border-l-2 pl-3 text-[15px] ${
                  pathname === link.href ? "border-on-bar font-semibold text-on-bar" : "border-transparent text-on-bar-2"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/15 py-3 sm:hidden">
              {languageSwitch}
              {themeButton}
            </div>
            {!isLoading && (
              <div className="flex gap-2 border-t border-white/15 py-3">
                {user ? (
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="min-h-11 flex-1 rounded-[3px] border border-white/30 text-sm font-medium"
                  >
                    {t.nav.logout}
                  </button>
                ) : (
                  <>
                    <Link href="/login" className="flex min-h-11 flex-1 items-center justify-center rounded-[3px] border border-white/30 text-sm font-medium">
                      {t.nav.login}
                    </Link>
                    <Link href="/register" className="flex min-h-11 flex-1 items-center justify-center rounded-[3px] bg-on-bar text-sm font-semibold text-bar">
                      {t.nav.register}
                    </Link>
                  </>
                )}
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
