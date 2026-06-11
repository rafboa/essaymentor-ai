"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const NAV_LINKS = [
    { href: "/", label: t.nav.home },
    { href: "/evaluator", label: t.nav.evaluator },
    { href: "/scholarships", label: t.nav.scholarships },
    { href: "/tips", label: t.nav.tips },
    { href: "/about", label: t.nav.about },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border backdrop-blur-xl bg-[#09090b]/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl">🎓</span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-slate-100">
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
                    ? "nav-link-active text-slate-100"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* CTA + Language Toggle + Mobile Toggle */}
        <div className="flex items-center gap-3">
          {/* Language Toggle */}
          <div className="flex items-center bg-card rounded-lg p-1 border border-border">
            <button
              onClick={() => setLanguage('id')}
              className={`px-2 py-1 text-xs font-medium rounded ${
                language === 'id' ? 'bg-primary-500/20 text-primary-300' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              ID
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 text-xs font-medium rounded ${
                language === 'en' ? 'bg-primary-500/20 text-primary-300' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              EN
            </button>
          </div>

          <Link
            href="/evaluator"
            className="btn-gradient rounded-lg px-4 py-2 text-sm hidden sm:inline-flex"
          >
            {t.nav.evaluate}
          </Link>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden flex flex-col gap-1 p-2"
            aria-label="Toggle menu"
          >
            <span
              className={`block h-0.5 w-5 bg-slate-300 transition-transform ${
                mobileOpen ? "translate-y-1.5 rotate-45" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-slate-300 transition-opacity ${
                mobileOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-slate-300 transition-transform ${
                mobileOpen ? "-translate-y-1.5 -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border animate-fade-in-up bg-[#09090b]">
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
                      ? "bg-primary-500/10 text-primary-400"
                      : "text-slate-400 hover:text-slate-200 hover:bg-card-hover"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/evaluator"
              onClick={() => setMobileOpen(false)}
              className="btn-gradient rounded-lg px-4 py-2.5 text-sm text-center mt-2"
            >
              {t.nav.evaluate}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
