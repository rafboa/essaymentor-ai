"use client";

import Link from "next/link";
import { useLanguage } from "../contexts/LanguageContext";
import { BrandMark } from "./BrandMark";

export function Footer() {
  const { t } = useLanguage();

  const groups = [
    {
      title: t.footer.product,
      links: [
        { href: "/evaluator", label: t.nav.evaluator },
        { href: "/scholarships", label: t.nav.scholarships },
        { href: "/tips", label: t.nav.tips },
      ],
    },
    { title: t.footer.about, links: [{ href: "/about", label: t.nav.about }] },
  ];

  return (
    <footer className="border-t border-rule">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:grid-cols-[1fr_auto_auto] sm:gap-16 sm:px-6 lg:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-[22px] w-4 text-ink" />
            <span className="text-[15px] font-bold tracking-tight">
              EssayMentor <span className="font-medium text-ink-2">AI</span>
            </span>
          </div>
          <p className="mt-3 text-sm text-ink-2">{t.brandTagline}</p>
          <p className="mt-6 text-xs text-ink-3">© 2026 · {t.footer.rights}</p>
        </div>
        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="label">{group.title}</h2>
            <ul className="mt-3 space-y-1">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="inline-flex min-h-8 items-center text-sm text-ink-2 hover:text-ink hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
