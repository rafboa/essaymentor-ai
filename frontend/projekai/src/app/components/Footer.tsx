"use client";

import Link from "next/link";
import { useLanguage } from "../contexts/LanguageContext";

export function Footer() {
  const { t } = useLanguage();

  const PRODUCT_LINKS = [
    { href: "/evaluator", label: t.nav.evaluator },
    { href: "/scholarships", label: t.nav.scholarships },
    { href: "/tips", label: t.nav.tips },
  ];

  const COMPANY_LINKS = [
    { href: "/about", label: t.nav.about },
  ];

  return (
    <footer className="relative z-10 border-t border-border mt-auto">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🎓</span>
              <span className="text-sm font-bold text-slate-100">
                EssayMentor <span className="gradient-text">AI</span>
              </span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              {t.footer.tag}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              {t.footer.product}
            </h4>
            <ul className="space-y-2">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              {t.footer.company}
            </h4>
            <ul className="space-y-2">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border">
          <p className="text-xs text-slate-600 text-center">
            © 2026 EssayMentor AI — {t.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
