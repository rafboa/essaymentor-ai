"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { PageHeader } from "../components/PageHeader";
import { SCHOLARSHIPS } from "../lib/scholarships";

export default function ScholarshipsPage() {
  const { t } = useLanguage();
  const items = t.scholarships.items;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <PageHeader title={t.scholarships.title} sub={t.scholarships.sub} />
      <ul className="divide-y divide-rule">
        {SCHOLARSHIPS.filter((s) => s.slug in items).map((s) => {
          const item = items[s.slug as keyof typeof items];
          return (
            <li key={s.slug} className="grid gap-4 py-9 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] md:gap-12">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{s.name}</h2>
                <p className="mt-1 text-sm text-ink-2">
                  {item.region} · {item.level}
                </p>
              </div>
              <div className="max-w-2xl">
                <p className="leading-relaxed">{item.desc}</p>
                <p className="mt-3 text-sm text-ink-2">
                  <span className="label mr-2">{t.scholarships.focus}</span>
                  {item.focus.join(" · ")}
                </p>
              </div>
              <Link
                href={`/evaluator?scholarship=${s.slug}`}
                className="btn self-start md:mt-1 md:w-80 md:justify-between"
              >
                {t.scholarships.evaluateFor(s.name)}
                <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
