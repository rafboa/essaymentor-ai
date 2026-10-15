"use client";

import Link from "next/link";
import { useLanguage } from "../contexts/LanguageContext";
import { PageHeader } from "../components/PageHeader";

export default function AboutPage() {
  const { t } = useLanguage();
  const a = t.about;

  const block = (title: string, children: React.ReactNode) => (
    <section className="grid gap-4 border-b border-rule py-10 md:grid-cols-[16rem_minmax(0,42rem)] md:gap-20">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="leading-relaxed">{children}</div>
    </section>
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <PageHeader title={a.title} sub={a.sub} />
      {block(a.missionTitle, <p>{a.mission}</p>)}
      {block(
        a.howTitle,
        <>
          <p>{a.howIntro}</p>
          <ul className="mt-4 space-y-2.5">
            {a.how.map((item) => (
              <li key={item} className="grid grid-cols-[14px_1fr] gap-3">
                <span aria-hidden="true" className="mt-[0.55em] h-[3px] w-3 bg-ink" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </>,
      )}
      {block(a.limitsTitle, <p>{a.limits}</p>)}
      {block(a.teamTitle, <p>{a.team}</p>)}
      <div className="pt-10 md:pl-[calc(16rem+5rem)]">
        <Link href="/evaluator" className="btn btn-primary min-h-11">
          {a.cta}
        </Link>
      </div>
    </div>
  );
}
