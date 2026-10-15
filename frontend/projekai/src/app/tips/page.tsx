"use client";

import Link from "next/link";
import { useLanguage } from "../contexts/LanguageContext";
import { PageHeader } from "../components/PageHeader";

export default function TipsPage() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <PageHeader title={t.tips.title} sub={t.tips.sub} />
      <div className="grid gap-12 pt-12 lg:grid-cols-[16rem_minmax(0,42rem)] lg:gap-20">
        <nav aria-label={t.tips.contents} className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="label">{t.tips.contents}</h2>
          <ol className="mt-3 space-y-1 border-l border-rule">
            {t.tips.items.map((tip, i) => (
              <li key={tip.title}>
                <a href={`#tip-${i + 1}`} className="-ml-px flex min-h-9 items-center border-l-2 border-transparent pl-3 text-sm text-ink-2 hover:border-ink hover:text-ink">
                  {tip.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article>
          {t.tips.items.map((tip, i) => (
            <section key={tip.title} id={`tip-${i + 1}`} className="scroll-mt-24 border-b border-rule pb-10 pt-2 [&:not(:first-child)]:pt-10">
              <h2 className="text-2xl font-semibold tracking-tight">{tip.title}</h2>
              <p className="mt-4 font-serif text-[1.0625rem] leading-[1.85] [font-variation-settings:'opsz'_16]">{tip.body}</p>
              <p className="mt-4 text-sm text-ink-2">
                {t.tips.improves}: <span className="font-semibold text-ink">{t.dims[tip.dim]}</span>
              </p>
            </section>
          ))}
          <div className="pt-10">
            <h2 className="text-xl font-semibold">{t.tips.ctaTitle}</h2>
            <Link href="/evaluator" className="btn btn-primary mt-5 min-h-11">
              {t.tips.cta}
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
