"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "./contexts/LanguageContext";
import { AnnotatedText, buildBeats, Glyph } from "./components/Notation";
import { useMediaQuery } from "./lib/useClient";
import { SAMPLE } from "./lib/sample";
import { SCHOLARSHIPS } from "./lib/scholarships";
import { bandOf } from "./lib/score";
import { ANNOTATION_TYPES } from "./lib/api";

export default function HomePage() {
  const { t, language } = useLanguage();
  const sample = SAMPLE[language];
  const beats = useMemo(() => buildBeats(sample.text, sample.annotations), [sample]);
  const [active, setActive] = useState<number | null>(4);
  const narrow = useMediaQuery("(max-width: 639px)");
  const activeNote = active !== null ? beats[active]?.notes[0] : undefined;

  return (
    <>
      {/* ── First viewport: the mechanism, working ── */}
      <section className="mx-auto grid max-w-[1440px] gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="flex flex-col justify-center">
          <h1 className="font-display text-[clamp(2.75rem,5.6vw,4.75rem)] font-extrabold uppercase leading-[0.96] tracking-[-0.01em] [font-variation-settings:'opsz'_72] [text-wrap:balance]">
            {t.home.title}
          </h1>
          <p className="mt-7 max-w-[34rem] text-lg leading-relaxed text-ink-2">{t.home.subtitle}</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/evaluator" className="btn btn-primary min-h-12 px-6 text-base">
              {t.home.cta}
            </Link>
            <Link href="/scholarships" className="btn btn-quiet min-h-12 text-base underline decoration-rule underline-offset-4 hover:decoration-ink">
              {t.home.secondary}
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink-2">{t.home.ctaNote}</p>
        </div>

        <figure className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-rule px-5 py-3">
            <span className="label">{t.home.specimenLabel}</span>
            <span className="tabular text-sm">
              <span className="font-display text-2xl font-extrabold [font-variation-settings:'opsz'_48]">{sample.score}</span>
              <span className="text-ink-2"> /100 · {t.bands[bandOf(sample.score).key]}</span>
            </span>
          </div>
          <div className="px-4 py-6 sm:px-5">
            <AnnotatedText
              beats={beats}
              active={active}
              onSelect={(i) => setActive(i)}
              idPrefix="sample"
              compact={narrow}
              textClassName="font-serif text-[0.9375rem] leading-[1.85] [font-variation-settings:'opsz'_14]"
            />
          </div>
          <div className="min-h-[5.5rem] border-t border-rule bg-paper px-5 py-4" aria-live="polite">
            {activeNote ? (
              <div className="flex gap-3">
                <Glyph type={activeNote.type} className="mt-1 h-4 w-3.5 shrink-0" />
                <p className="text-sm leading-relaxed">
                  <span className={`mr-2 text-xs font-bold uppercase tracking-wider mark-label-${activeNote.type.toLowerCase()}`}>
                    {t.marks[activeNote.type]} · {t.evaluator.sentence((active ?? 0) + 1)}
                  </span>
                  {activeNote.message}
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-2">{t.evaluator.staffHelp}</p>
            )}
          </div>
          <figcaption className="border-t border-rule px-5 py-3 text-xs text-ink-2">{t.home.specimenCaption}</figcaption>
        </figure>
      </section>

      {/* ── The notation ── */}
      <section className="border-t border-rule">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:px-8">
          <div>
            <h2 className="font-display text-[clamp(2.25rem,4vw,3.5rem)] font-extrabold uppercase leading-[0.96] [font-variation-settings:'opsz'_72]">
              {t.home.notationTitle}
            </h2>
            <p className="mt-5 max-w-[30rem] leading-relaxed text-ink-2">{t.home.notationSub}</p>
          </div>
          <ul className="divide-y divide-rule border-y border-rule">
            {ANNOTATION_TYPES.map((type) => (
              <li key={type} className="grid grid-cols-[20px_9rem_minmax(0,1fr)] items-center gap-4 py-5 max-sm:grid-cols-[20px_1fr]">
                <Glyph type={type} className="h-7 w-4" />
                <span>
                  <span className="block font-semibold">{t.marks[type]}</span>
                  <span className="block text-sm text-ink-2">{t.marksHelp[type]}</span>
                </span>
                <span
                  className={`mark mark-${type.toLowerCase()} cursor-default font-serif text-lg hover:bg-transparent hover:shadow-none max-sm:col-start-2`}
                >
                  {sample.text.split(". ")[0].split(" ").slice(0, 6).join(" ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── The loop ── */}
      <section className="border-t border-rule">
        <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(2.25rem,4vw,3.5rem)] font-extrabold uppercase leading-[0.96] [font-variation-settings:'opsz'_72]">
            {t.home.loopTitle}
          </h2>
          <ol className="relative mt-12 grid gap-10 md:grid-cols-4 md:gap-8">
            <span aria-hidden="true" className="absolute left-0 right-0 top-[7px] hidden h-[5px] border-y border-ink md:block" />
            {t.home.loop.map((step, i) => (
              <li key={step.title} className="relative md:pt-10">
                <span aria-hidden="true" className="absolute top-0 hidden h-[19px] w-4 bg-ink md:block" />
                <span className="tabular text-sm font-semibold text-ink-2">{i + 1}</span>
                <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-[22rem] text-sm leading-relaxed text-ink-2">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Scholarships ── */}
      <section className="border-t border-rule">
        <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="max-w-3xl font-display text-[clamp(2.25rem,4vw,3.5rem)] font-extrabold uppercase leading-[0.96] [font-variation-settings:'opsz'_72]">
            {t.home.scholarshipsTitle}
          </h2>
          <ul className="mt-10 grid border-t border-rule sm:grid-cols-2 lg:grid-cols-4">
            {SCHOLARSHIPS.filter((s) => s.name).map((s) => (
              <li key={s.slug} className="border-b border-rule">
                <Link
                  href={`/evaluator?scholarship=${s.slug}`}
                  className="group flex min-h-16 items-center justify-between gap-4 px-1 py-4 hover:bg-band sm:px-4"
                >
                  <span>
                    <span className="block font-semibold">{s.name}</span>
                    <span className="block text-sm text-ink-2">
                      {t.scholarships.items[s.slug as keyof typeof t.scholarships.items].region}
                    </span>
                  </span>
                  <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" className="text-ink-3 group-hover:text-ink" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Close ── */}
      <section className="bg-bar text-on-bar">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div>
            <h2 className="max-w-3xl font-display text-[clamp(2.25rem,5vw,4.25rem)] font-extrabold uppercase leading-[0.96] [font-variation-settings:'opsz'_72]">
              {t.home.closingTitle}
            </h2>
            <p className="mt-5 max-w-xl text-on-bar-2">{t.home.closingSub}</p>
          </div>
          <Link href="/evaluator" className="btn btn-primary btn-on-bar min-h-12 px-6 text-base">
            {t.home.cta}
            <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
