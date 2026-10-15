"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { ApiError, apiGet, DIMENSIONS, draftName, type DraftSummary, type FeedbackSummary } from "../lib/api";
import { scholarshipByValue } from "../lib/scholarships";
import { bandOf } from "../lib/score";

const composite = (f: FeedbackSummary) =>
  Math.round(DIMENSIONS.reduce((sum, d) => sum + f.scores[d], 0) / DIMENSIONS.length);

export default function DashboardPage() {
  const { user, token, isLoading, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?next=/dashboard");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!token) return;
    apiGet<DraftSummary[]>("/essay/history", token)
      .then((data) => setDrafts(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          logout({ redirect: false });
          router.replace("/login?next=/dashboard");
        } else setFailed(true);
      });
  }, [token, logout, router]);

  if (isLoading || !user) return <div className="min-h-[60vh]" />;

  const date = new Intl.DateTimeFormat(t.locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-8">
        <div>
          <h1 className="font-display text-[clamp(2.5rem,5vw,4rem)] font-extrabold uppercase leading-[0.96] [font-variation-settings:'opsz'_72]">
            {t.dashboard.greeting(user.fullName)}
          </h1>
          <p className="mt-4 max-w-xl text-ink-2">{t.dashboard.sub}</p>
        </div>
        <Link href="/evaluator" className="btn btn-primary min-h-11">
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          {t.dashboard.newEssay}
        </Link>
      </div>

      {failed ? (
        <p role="alert" className="py-16 text-ink-2">
          {t.dashboard.error}
        </p>
      ) : drafts === null ? (
        <p className="py-16 text-ink-2" aria-busy="true">
          {t.dashboard.loading}
        </p>
      ) : drafts.length === 0 ? (
        <div className="max-w-md py-20">
          <h2 className="text-2xl font-semibold">{t.dashboard.emptyTitle}</h2>
          <p className="mt-3 text-ink-2">{t.dashboard.emptyBody}</p>
          <Link href="/evaluator" className="btn btn-primary mt-8 min-h-11">
            {t.dashboard.emptyCta}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-rule">
          {drafts.map((draft) => {
            const history = [...draft.aiFeedbacks].reverse().filter((f) => f.feedbackType === "FULL_ESSAY");
            const latest = history.at(-1);
            const prior = history.at(-2);
            const score = latest ? composite(latest) : null;
            const delta = latest && prior ? composite(latest) - composite(prior) : null;
            const name = draftName(draft.title, draft.content) || t.evaluator.untitled;
            const program = scholarshipByValue(draft.scholarshipTarget)?.name || t.dashboard.general;
            return (
              <li key={draft.id} className="grid gap-6 py-7 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)_10rem] md:items-center md:gap-10">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">
                    <Link href={`/evaluator?draftId=${draft.id}`} className="hover:underline">
                      {name}
                    </Link>
                  </h2>
                  <p className="tabular mt-1 text-sm text-ink-2">
                    {program} · {t.dashboard.versions(draft.aiFeedbacks.length)} · {t.dashboard.updated}{" "}
                    {date.format(new Date(draft.updatedAt))}
                  </p>
                </div>

                {/* Every evaluation on one fixed 0–100 scale, newest on top */}
                <figure className="min-w-0">
                  {history.length > 1 ? (
                    <>
                      <ol className="space-y-1.5">
                        {history
                          .map((f, i) => ({ f, n: i + 1 }))
                          .slice(-4)
                          .reverse()
                          .map(({ f, n }, i) => (
                            <li key={f.id} className="grid grid-cols-[2rem_1fr_2rem] items-center gap-3 text-xs">
                              <span className="tabular text-ink-2">#{n}</span>
                              <span className="relative h-2 bg-band" aria-hidden="true">
                                <span
                                  className={`absolute inset-y-0 left-0 ${i === 0 ? "bg-ink" : "bg-ink-3"}`}
                                  style={{ width: `${composite(f)}%` }}
                                />
                              </span>
                              <span className={`tabular text-right ${i === 0 ? "font-semibold text-ink" : "text-ink-2"}`}>{composite(f)}</span>
                            </li>
                          ))}
                      </ol>
                      <figcaption className="mt-2 text-xs text-ink-2">{t.dashboard.progress}</figcaption>
                    </>
                  ) : (
                    // One evaluation: the score column already shows it, so a one-row chart would repeat it.
                    <span className="text-sm text-ink-2">
                      {history.length === 1
                        ? t.dashboard.firstOnly
                        : draft.aiFeedbacks.length === 0
                          ? t.dashboard.unfinished
                          : t.dashboard.passagesOnly}
                    </span>
                  )}
                </figure>

                <div className="flex items-end justify-between gap-4 md:flex-col md:items-end">
                  {score !== null ? (
                    <div className="md:text-right">
                      <span className="tabular font-display text-5xl font-extrabold leading-none [font-variation-settings:'opsz'_72]">{score}</span>
                      <span className="tabular block text-xs text-ink-2">
                        {t.bands[bandOf(score).key]}
                        {delta !== null && ` · ${t.evaluator.delta(delta)}`}
                      </span>
                    </div>
                  ) : (
                    <span />
                  )}
                  <Link
                    href={`/evaluator?draftId=${draft.id}`}
                    className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold hover:underline"
                    aria-label={`${t.dashboard.open}: ${name}`}
                  >
                    {t.dashboard.open}
                    <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
