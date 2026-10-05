"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const currentTheme = theme === 'system' ? resolvedTheme : theme;

  const NAV_LINKS = [
    { href: "/", label: t.nav.home },
    { href: "/evaluator", label: t.nav.evaluator },
    { href: "/scholarships", label: t.nav.scholarships },
    { href: "/tips", label: t.nav.tips },
    { href: "/about", label: t.nav.about },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border backdrop-blur-xl bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl">🎓</span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-foreground">
              EssayMentor <span className="gradient-text">AI</span>
            </span>
            <span className="text-[10px] text-slate-500 hidden sm:block">
              {language === 'id' ? 'Evaluasi cerdas. Tulisan autentik.' : 'Evaluate smarter. Write truer.'}
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link px-3 py-2 text-sm font-medium ${
                  isActive
                    ? "nav-link-active"
                    : "text-slate-600 dark:text-slate-400 hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* CTA + Language Toggle + Theme Toggle + Mobile Toggle */}
        <div className="flex items-center gap-3">
          {mounted && (
            <button
              onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-slate-600 dark:text-slate-400 hover:text-foreground transition-colors rounded-lg focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Toggle Theme"
            >
              {currentTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}

          {/* Language Toggle */}
          <div className="flex items-center bg-card rounded-lg p-1 border border-border">
            <button
              onClick={() => setLanguage('id')}
              className={`px-2 py-1 text-xs font-medium rounded ${
                language === 'id' ? 'bg-primary-500/20 text-primary-600 dark:text-primary-300 font-semibold' : 'text-slate-500 hover:text-foreground'
              }`}
            >
              ID
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 text-xs font-medium rounded ${
                language === 'en' ? 'bg-primary-500/20 text-primary-600 dark:text-primary-300 font-semibold' : 'text-slate-500 hover:text-foreground'
              }`}
            >
              EN
            </button>
          </div>

          {/* Auth Buttons */}
          <div className="hidden sm:flex items-center gap-2 ml-2 border-l border-border pl-4">
            {user ? (
              <>
                <Link href="/dashboard" className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-foreground">
                  Dashboard
                </Link>
                <button onClick={logout} className="text-sm font-medium text-red-500 hover:text-red-400 ml-3">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-foreground">
                  Login
                </Link>
                <Link href="/register" className="btn-gradient rounded-lg px-4 py-1.5 text-sm ml-2">
                  Daftar
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden flex flex-col gap-1 p-2 focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
            aria-label="Toggle menu"
          >
            <span
              className={`block h-0.5 w-5 bg-foreground transition-transform ${
                mobileOpen ? "translate-y-1.5 rotate-45" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-foreground transition-opacity ${
                mobileOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-foreground transition-transform ${
                mobileOpen ? "-translate-y-1.5 -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border animate-fade-in-up bg-background">
          <nav className="flex flex-col px-4 py-3 gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-500/10 text-primary-600 dark:text-primary-400"
                      : "text-slate-600 dark:text-slate-400 hover:bg-card-hover hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            
            <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2">
              {user ? (
                <>
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-slate-700 dark:text-slate-300 px-3">Dashboard</Link>
                  <button onClick={() => { logout(); setMobileOpen(false); }} className="text-sm font-medium text-red-500 px-3 text-left">Logout</button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-slate-700 dark:text-slate-300 px-3">Login</Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="btn-gradient rounded-lg px-4 py-2.5 text-sm text-center mt-2">Daftar</Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
