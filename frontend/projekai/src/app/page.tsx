"use client";

import Link from "next/link";
import { useLanguage } from "./contexts/LanguageContext";

export default function HomePage() {
  const { t } = useLanguage();

  const FEATURES = [
    { icon: "📊", ...t.home.feat1 },
    { icon: "🎯", ...t.home.feat2 },
    { icon: "🛡️", ...t.home.feat3 },
    { icon: "⚡", ...t.home.feat4 },
  ];

  const STEPS = [
    { num: "01", icon: "🎓", ...t.home.step1 },
    { num: "02", icon: "✍️", ...t.home.step2 },
    { num: "03", icon: "🚀", ...t.home.step3 },
  ];

  return (
    <div className="relative">
      {/* ═══ HERO ═══ */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 sm:pt-32 pb-16 sm:pb-24 text-center">
        <div className="animate-fade-in-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-xs text-slate-400 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-400 animate-pulse" />
            {t.home.tag}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.15] mb-6">
            {t.home.title1}
            <br />
            <span className="gradient-text">{t.home.title2}</span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg sm:text-xl text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
            {t.home.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/evaluator"
              className="btn-gradient rounded-xl px-8 py-3.5 text-base font-semibold"
            >
              {t.home.startFree}
            </Link>
            <Link
              href="/scholarships"
              className="rounded-xl border border-border px-8 py-3.5 text-base font-medium text-foreground hover:bg-card-hover transition-all"
            >
              {t.home.browseSch}
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 stagger-children">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="glass glass-hover rounded-2xl p-6"
            >
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500/10 text-2xl">
                {f.icon}
              </span>
              <h3 className="text-base font-semibold text-foreground mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            {t.home.howItWorks}
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            {t.home.howItWorksSub}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 stagger-children">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="glass glass-hover rounded-2xl p-8 text-center relative overflow-hidden"
            >
              <span className="absolute top-4 right-4 text-5xl font-black text-foreground/5">
                {step.num}
              </span>
              <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-500/10 text-3xl">
                {step.icon}
              </span>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <div className="glass rounded-3xl p-10 sm:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 pointer-events-none" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4">
              {t.home.ready}
            </h2>
            <p className="text-lg text-slate-400 mb-8 max-w-lg mx-auto">
              {t.home.readySub}
            </p>
            <Link
              href="/evaluator"
              className="btn-gradient rounded-xl px-8 py-3.5 text-base font-semibold inline-flex"
            >
              {t.home.startFree}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
