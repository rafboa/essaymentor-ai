"use client";

import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Pencil, TriangleAlert } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { AuthForm } from "../components/AuthForm";
import { AnnotatedText, buildBeats, Glyph, NotationLegend, type Beat } from "../components/Notation";
import {
  ApiError,
  apiGet,
  DEFAULT_TITLE,
  DIMENSIONS,
  draftName,
  evaluationFromDraft,
  openEvaluationStream,
  readEvents,
  type DraftDetail,
  type Evaluation,
} from "../lib/api";
import { BANDS, bandOf } from "../lib/score";
import { SCHOLARSHIPS, scholarshipBySlug } from "../lib/scholarships";
import { clearDraft, loadDraft, saveDraft } from "../lib/draftStore";
import type { Dictionary } from "../i18n/dictionaries";
import { useIsMac, useMediaQuery } from "../lib/useClient";

const MIN_CHARS = 50;
const MAX_CHARS = 25000;

type ErrorKind =
  | "tooShort"
  | "selectionTooShort"
  | "rateLimited"
  | "throttled"
  | "dropped"
  | "network"
  | "server"
  | "notFound";

export default function EvaluatorPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <Evaluator />
    </Suspense>
  );
}

function Evaluator() {
  const { t } = useLanguage();
  const { token, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const urlDraftId = params.get("draftId");
  const ids = useId();

  // The draft this page currently holds. A URL change to this same id is not a reload.
  const heldDraftId = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingRun = useRef<null | { passage?: string }>(null);

  const [title, setTitle] = useState("");
  const [scholarship, setScholarship] = useState(
    () => scholarshipBySlug(params.get("scholarship"))?.value ?? SCHOLARSHIPS[0].value,
  );
  const [content, setContent] = useState("");
  const [loadingDraft, setLoadingDraft] = useState(!!urlDraftId);
  const [restored, setRestored] = useState<string | null>(null);

  const [result, setResult] = useState<Evaluation | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [previous, setPrevious] = useState<{ score: number } | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [received, setReceived] = useState(0);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [lastRun, setLastRun] = useState<{ passage?: string } | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [announce, setAnnounce] = useState("");

  const [view, setView] = useState<"edit" | "review">("edit");
  const [tab, setTab] = useState<"essay" | "result">("essay");
  const [active, setActive] = useState<number | null>(null);
  const [selection, setSelection] = useState("");
  const isMac = useIsMac();
  const narrow = useMediaQuery("(max-width: 639px)");

  /* ── Load: server draft and/or local copy ───────────────────── */
  useEffect(() => {
    if (authLoading) return;
    if (urlDraftId && urlDraftId === heldDraftId.current) return;

    if (!urlDraftId) {
      // Reading the local copy has to wait for hydration; the server has no localStorage.
      const local = loadDraft(null);
      if (local) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage after hydration
        setTitle(local.title);
        setContent(local.content);
        if (local.scholarship) setScholarship(local.scholarship);
        if (local.pendingEvaluation) pendingRun.current = {};
      }
      setLoadingDraft(false);
      return;
    }
    if (!token) {
      setLoadingDraft(false);
      setAuthOpen(true);
      return;
    }

    let cancelled = false;
    setLoadingDraft(true);
    apiGet<DraftDetail>(`/essay/${urlDraftId}`, token)
      .then((draft) => {
        if (cancelled) return;
        heldDraftId.current = draft.id;
        const local = loadDraft(draft.id);
        const useLocal = !!local && local.content !== draft.content && local.savedAt > Date.parse(draft.updatedAt);
        setTitle(useLocal ? local!.title : draft.title === DEFAULT_TITLE ? "" : draft.title);
        setContent(useLocal ? local!.content : draft.content);
        setScholarship(draft.scholarshipTarget ?? SCHOLARSHIPS[0].value);
        setRestored(useLocal ? draft.content : null);
        setVersion(draft.version);
        const evaluation = evaluationFromDraft(draft);
        setResult(evaluation);
        const prior = draft.previousFullEssay;
        if (prior && evaluation?.mode === "FULL_ESSAY") {
          const score = Math.round(DIMENSIONS.reduce((s, d) => s + prior.scores[d], 0) / DIMENSIONS.length);
          setPrevious({ score });
        }
        if (evaluation?.evaluatedText && !useLocal) setView("review");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          logout({ redirect: false });
          setAuthNotice(t.evaluator.errors.sessionExpired);
          setAuthOpen(true);
        } else {
          setError(
            err instanceof ApiError && (err.status === 404 || err.status === 403)
              ? "notFound"
              : err instanceof ApiError && err.status === 429
                ? "throttled"
                : "network",
          );
        }
      })
      .finally(() => !cancelled && setLoadingDraft(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlDraftId, token, authLoading]);

  /* ── Autosave every edit locally ───────────────────────────── */
  useEffect(() => {
    if (loadingDraft || !content) return;
    const id = setTimeout(
      () => saveDraft(heldDraftId.current, { title, scholarship, content, pendingEvaluation: !!pendingRun.current }),
      400,
    );
    return () => clearTimeout(id);
  }, [title, scholarship, content, loadingDraft]);

  /* ── Evaluate ──────────────────────────────────────────────── */
  const run = useCallback(
    async (opts: { passage?: string } = {}) => {
      const passage = opts.passage;
      const text = content.trim();
      if (passage !== undefined && passage.trim().length < MIN_CHARS) return setError("selectionTooShort");
      if (text.length < MIN_CHARS) return setError("tooShort");

      if (!token) {
        pendingRun.current = opts;
        saveDraft(heldDraftId.current, { title, scholarship, content, pendingEvaluation: true });
        setAuthNotice(null);
        setAuthOpen(true);
        setTab("result");
        return;
      }

      pendingRun.current = null;
      setAuthOpen(false);
      setLastRun(opts);
      setError(null);
      setStreaming(true);
      setReceived(0);
      setTab("result");
      setAnnounce(t.evaluator.streaming);
      const before = result && result.mode === "FULL_ESSAY" ? { score: result.compositeScore } : null;

      const controller = new AbortController();
      abortRef.current = controller;
      let finished = false;
      try {
        const stream = await openEvaluationStream(
          {
            draftId: heldDraftId.current ?? undefined,
            title: title.trim() || undefined,
            scholarshipTarget: scholarship,
            content: text,
            mode: passage ? "PARAGRAPH" : "FULL_ESSAY",
            targetText: passage?.trim(),
          },
          token,
          controller.signal,
        );
        for await (const ev of readEvents(stream)) {
          if (ev.event === "chunk") setReceived((n) => n + ev.data.text.length);
          else if (ev.event === "error") {
            finished = true;
            if (ev.data.draftId) heldDraftId.current = ev.data.draftId;
            setError("server");
          } else if (ev.event === "done") {
            finished = true;
            const evaluation: Evaluation = {
              ...ev.data.evaluation,
              mode: passage ? "PARAGRAPH" : "FULL_ESSAY",
              evaluatedText: passage?.trim() ?? text,
            };
            const newId = ev.data.draft.id;
            clearDraft(null);
            clearDraft(newId);
            heldDraftId.current = newId;
            setResult(evaluation);
            setVersion(ev.data.draft.version);
            setPrevious(passage ? null : before);
            setRestored(null);
            setActive(null);
            setView("review");
            setAnnounce(`${t.evaluator.score}: ${evaluation.compositeScore} ${t.evaluator.of100}`);
            if (urlDraftId !== newId) router.replace(`/evaluator?draftId=${newId}`, { scroll: false });
          }
        }
        if (!finished && !controller.signal.aborted) setError("dropped");
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) {
          logout({ redirect: false });
          pendingRun.current = opts;
          saveDraft(heldDraftId.current, { title, scholarship, content, pendingEvaluation: true });
          setAuthNotice(t.evaluator.errors.sessionExpired);
          setAuthOpen(true);
        } else if (err instanceof ApiError && err.status === 429) setError("rateLimited");
        else if (err instanceof ApiError && err.status === 400) setError("tooShort");
        else if (err instanceof ApiError && (err.status === 403 || err.status === 404)) setError("notFound");
        else if (err instanceof ApiError) setError("server");
        else setError(finished ? "server" : "network");
      } finally {
        abortRef.current = null;
        setStreaming(false);
      }
    },
    [content, token, title, scholarship, result, urlDraftId, router, logout, t],
  );

  // Resume an evaluation a guest asked for, once they're signed in.
  useEffect(() => {
    if (token && pendingRun.current && !streaming && !loadingDraft && content.trim().length >= MIN_CHARS) {
      run(pendingRun.current);
    }
  }, [token, streaming, loadingDraft, content, run]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /* ── Derived ───────────────────────────────────────────────── */
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const tooShort = content.trim().length < MIN_CHARS;
  const beats = useMemo(
    () => (result?.evaluatedText ? buildBeats(result.evaluatedText, result.annotations) : []),
    [result],
  );
  const stale = !!result && result.mode === "FULL_ESSAY" && !!result.evaluatedText && result.evaluatedText !== content.trim();
  const canReview = beats.length > 0;
  const showReview = view === "review" && canReview;

  // The essay box grows with its text. Browsers with `field-sizing: content`
  // do this in CSS; elsewhere size it to its content after each change, and
  // again when its width changes (window resize, phone rotation) or the web
  // fonts arrive, since both re-wrap the lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || CSS.supports("field-sizing", "content")) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [content, showReview]);

  // Scrolling waits for the commit, so a note tapped on the phone's Result tab
  // can first reveal the Essay tab and then bring its sentence into view.
  const [scrollTo, setScrollTo] = useState<{ id: string; block: ScrollLogicalPosition; n: number } | null>(null);
  useEffect(() => {
    if (!scrollTo) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(scrollTo.id)?.scrollIntoView({ block: scrollTo.block, behavior: reduce ? "auto" : "smooth" });
  }, [scrollTo]);

  const select = useCallback(
    (index: number, from: "staff" | "text" | "note") => {
      setActive(index);
      if (from === "note") {
        setView("review");
        setTab("essay");
      }
      setScrollTo(
        from === "text"
          ? { id: `${ids}-n-${index}`, block: "nearest", n: Date.now() }
          : { id: `${ids}-s-${index}`, block: "center", n: Date.now() },
      );
    },
    [ids],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!streaming) run();
    }
  };

  const trackSelection = () => {
    const el = textareaRef.current;
    if (!el) return;
    setSelection(el.value.slice(el.selectionStart, el.selectionEnd));
  };

  const primaryLabel = result ? t.evaluator.reevaluate : t.evaluator.evaluate;

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="mx-auto max-w-[1440px]">
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-rule px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="sr-only">{t.evaluator.title}</h1>
        <div className={`min-w-[12rem] flex-1 ${showReview ? "max-md:hidden" : ""}`}>
          <label htmlFor={`${ids}-title`} className="label">
            {t.evaluator.titleLabel}
          </label>
          <input
            id={`${ids}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder={content.trim() ? draftName("", content) : t.evaluator.titlePlaceholder}
            className="mt-1 block w-full rounded-[3px] bg-transparent py-1 text-xl font-semibold tracking-tight text-ink outline-offset-4 placeholder:font-normal placeholder:text-ink-3"
          />
        </div>
        <div className={`w-full sm:w-56 ${showReview ? "max-md:hidden" : ""}`}>
          <label htmlFor={`${ids}-sch`} className="label">
            {t.evaluator.scholarshipLabel}
          </label>
          <select
            id={`${ids}-sch`}
            value={scholarship}
            onChange={(e) => setScholarship(e.target.value)}
            className="field mt-1 font-medium"
          >
            {SCHOLARSHIPS.map((s) => (
              <option key={s.slug} value={s.value}>
                {s.name || t.evaluator.scholarshipOther}
              </option>
            ))}
          </select>
        </div>
        {version && (
          <span
            className={`tabular mb-2.5 rounded-[3px] border border-rule px-2 py-1 text-xs font-medium text-ink-2 ${showReview ? "max-md:hidden" : ""}`}
          >
            {t.evaluator.version(version)}
          </span>
        )}
        {showReview && (
          <p className="w-full truncate text-sm md:hidden">
            <span className="font-semibold">{draftName(title, content)}</span>
            <span className="text-ink-2">
              {" "}
              · {SCHOLARSHIPS.find((s) => s.value === scholarship)?.name || t.evaluator.scholarshipOther}
              {version ? ` · ${t.evaluator.version(version)}` : ""}
            </span>
          </p>
        )}
        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          {showReview ? (
            <button type="button" className="btn min-h-11 flex-1 sm:flex-none" onClick={() => setView("edit")}>
              <Pencil size={15} strokeWidth={1.75} aria-hidden="true" />
              {t.evaluator.edit}
            </button>
          ) : (
            selection.trim().length >= MIN_CHARS && (
              <button type="button" className="btn min-h-11 flex-1 sm:flex-none" disabled={streaming} onClick={() => run({ passage: selection })}>
                {t.evaluator.evaluateSelection(selection.trim().length)}
              </button>
            )
          )}
          <button
            type="button"
            className="btn btn-primary min-h-11 flex-1 sm:flex-none"
            disabled={streaming || tooShort || content.length > MAX_CHARS}
            aria-describedby={tooShort ? `${ids}-min` : undefined}
            onClick={() => run()}
          >
            {streaming ? t.evaluator.evaluating : primaryLabel}
          </button>
        </div>
      </div>

      {/* Phone: two hard halves */}
      <div className="grid grid-cols-2 border-b border-rule lg:hidden" role="group" aria-label={t.evaluator.title}>
        {(["essay", "result"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={tab === k}
            onClick={() => setTab(k)}
            className={`-mb-px min-h-12 border-b-2 text-sm font-semibold ${
              tab === k ? "border-rule-strong text-ink" : "border-transparent text-ink-3"
            }`}
          >
            {k === "essay" ? t.evaluator.tabEssay : t.evaluator.tabResult}
            {k === "result" && streaming && <span className="pulse-bar ml-2 inline-block h-2 w-2 rounded-full bg-ink align-middle" />}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* ── Essay column ── */}
        <section
          aria-label={t.evaluator.tabEssay}
          className={`${tab === "essay" ? "" : "max-lg:hidden"} min-w-0 px-4 py-6 sm:px-6 lg:border-r lg:border-rule lg:px-8 lg:py-8`}
        >
          {restored !== null && view === "edit" && (
            <div role="status" className="mb-5 flex flex-wrap items-center gap-3 border-l-2 border-rule-strong pl-3 text-sm">
              <span>{t.evaluator.restored}</span>
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => {
                  setContent(restored);
                  clearDraft(heldDraftId.current);
                  setRestored(null);
                }}
              >
                {t.evaluator.discardRestored}
              </button>
            </div>
          )}

          {loadingDraft ? (
            <p className="py-24 text-center text-sm text-ink-2">{t.evaluator.loading}</p>
          ) : showReview ? (
            <AnnotatedText
              beats={beats}
              active={active}
              onSelect={select}
              idPrefix={ids}
              compact={narrow}
              textClassName="max-w-[42rem] font-serif text-[1.0625rem] leading-[1.9] text-ink [font-variation-settings:'opsz'_18] sm:text-[1.125rem]"
            />
          ) : (
            <div className="mx-auto max-w-[44rem]">
              <label htmlFor={`${ids}-essay`} className="sr-only">
                {t.evaluator.essayLabel}
              </label>
              <textarea
                id={`${ids}-essay`}
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={onKeyDown}
                onSelect={trackSelection}
                onKeyUp={trackSelection}
                onMouseUp={trackSelection}
                readOnly={streaming}
                maxLength={MAX_CHARS}
                placeholder={t.evaluator.essayPlaceholder}
                aria-describedby={`${ids}-counts`}
                className="-mx-2 -mt-2 block min-h-[55vh] w-[calc(100%+1rem)] resize-none rounded-[4px] bg-transparent p-2 sm:-mx-3 sm:-mt-3 sm:w-[calc(100%+1.5rem)] sm:p-3 font-serif text-[1.125rem] leading-[1.85] text-ink [field-sizing:content] [font-variation-settings:'opsz'_18] placeholder:text-ink-3 read-only:text-ink-2"
              />
              <div
                id={`${ids}-counts`}
                className="tabular mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-rule pt-3 text-xs text-ink-2"
              >
                <span>{t.evaluator.words(words)}</span>
                <span>{t.evaluator.chars(content.length)}</span>
                {tooShort ? (
                  <span id={`${ids}-min`} className="font-semibold text-ink">
                    {t.evaluator.minChars(content.trim().length)}
                  </span>
                ) : (
                  <span className="hidden sm:inline">{t.evaluator.shortcut(isMac)}</span>
                )}
                {!tooShort && selection.trim().length < MIN_CHARS && (
                  <span className="hidden md:inline">{t.evaluator.selectionHint}</span>
                )}
                {content && (
                  <span className="ml-auto inline-flex items-center gap-1">
                    <Check size={13} strokeWidth={2} aria-hidden="true" />
                    {t.evaluator.savedLocally}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Result rail ── */}
        <section
          aria-label={t.evaluator.tabResult}
          className={`${tab === "result" ? "" : "max-lg:hidden"} min-w-0 px-4 py-6 sm:px-6 lg:sticky lg:top-14 lg:max-h-[calc(100vh-3.5rem)] lg:self-start lg:overflow-y-auto lg:px-7 lg:py-8`}
        >
          {authOpen && !token ? (
            <AuthForm initialMode="register" inline redirectTo={null} headingLevel="h2" notice={authNotice} />
          ) : (
            <>
              {streaming && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold">
                    {t.evaluator.streaming}
                  </h2>
                  <p className="mt-2 text-sm text-ink-2">{t.evaluator.streamingSub}</p>
                  <div className="mt-5 h-1 overflow-hidden bg-band">
                    <div className="pulse-bar h-full bg-ink" style={{ width: received ? `${Math.min(95, 8 + received / 25)}%` : "8%" }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-ink-2">
                    <span className="tabular">{t.evaluator.received(received)}</span>
                    <button type="button" className="font-semibold underline" onClick={() => abortRef.current?.abort()}>
                      {t.evaluator.cancel}
                    </button>
                  </div>
                </div>
              )}

              {error && !streaming && (
                <div role="alert" className="mb-8 border-l-2 border-mark-critical pl-4">
                  <p className="flex items-start gap-2 text-sm font-medium text-ink">
                    <TriangleAlert size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-mark-critical" aria-hidden="true" />
                    {t.evaluator.errors[error]}
                  </p>
                  {(error === "dropped" || error === "network" || error === "server" || error === "rateLimited") && lastRun && (
                    <button type="button" className="btn mt-3 min-h-11" onClick={() => run(lastRun)}>
                      {t.evaluator.errors.retry}
                    </button>
                  )}
                </div>
              )}

              {result ? (
                <div className={streaming ? "opacity-60" : ""} aria-busy={streaming}>
                  {streaming && <p className="label mb-4">{t.evaluator.previous}</p>}
                  <ResultPanel
                    result={result}
                    previous={previous}
                    beats={beats}
                    active={active}
                    stale={stale}
                    onSelect={select}
                    idPrefix={ids}
                    t={t}
                  />
                </div>
              ) : (
                !streaming &&
                !error && (
                  <div className="py-6">
                    <h2 className="text-xl font-semibold">
                      {t.evaluator.emptyTitle}
                    </h2>
                    <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-2">{t.evaluator.emptyBody}</p>
                    {!token && <p className="mt-4 max-w-sm text-sm text-ink">{t.evaluator.needAccount}</p>}
                    <div className="mt-8">
                      <h3 className="label mb-3">{t.evaluator.notation}</h3>
                      <NotationLegend />
                    </div>
                  </div>
                )
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/* ── Result panel ─────────────────────────────────────────────── */

function ResultPanel({
  result,
  previous,
  beats,
  active,
  stale,
  onSelect,
  idPrefix,
  t,
}: {
  result: Evaluation;
  previous: { score: number } | null;
  beats: Beat[];
  active: number | null;
  stale: boolean;
  onSelect: (i: number, from: "staff" | "text" | "note") => void;
  idPrefix: string;
  t: Dictionary;
}) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const band = bandOf(result.compositeScore);
  const notes = [...result.annotations].sort((a, b) => a.sentenceIndex - b.sentenceIndex);
  const ordered = [...notes.filter((n) => n.type !== "STRENGTH"), ...notes.filter((n) => n.type === "STRENGTH")];
  const listsMissing = result.topImprovements.length === 0 && result.topStrengths.length === 0;

  const noteItem = (n: (typeof notes)[number], i: number) => {
    const beat = beats[n.sentenceIndex];
    const mapped = !!beat;
    const isActive = active === n.sentenceIndex;
    const body = (
      <>
        <Glyph type={n.type} className="mt-1 h-4 w-3.5 shrink-0" />
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className={`text-xs font-bold uppercase tracking-wider mark-label-${n.type.toLowerCase()}`}>{t.marks[n.type]}</span>
            <span className="tabular text-xs text-ink-2">
              {mapped ? t.evaluator.sentence(n.sentenceIndex + 1) : t.evaluator.sentenceUnmapped}
            </span>
          </span>
          <span lang="id" className="mt-1 block text-sm leading-relaxed text-ink">
            {n.message}
          </span>
          {mapped && <span className="mt-1.5 block truncate font-serif text-[13px] italic text-ink-2">“{beat.text}”</span>}
        </span>
      </>
    );
    return (
      <li key={`${n.sentenceIndex}-${i}`} id={`${idPrefix}-n-${n.sentenceIndex}`}>
        {mapped ? (
          <button
            type="button"
            onClick={() => onSelect(n.sentenceIndex, "note")}
            aria-current={isActive ? "true" : undefined}
            className={`flex w-full gap-3 rounded-[3px] px-2 py-2.5 text-left ${isActive ? "bg-band" : "hover:bg-band"}`}
          >
            {body}
          </button>
        ) : (
          <div className="flex gap-3 px-2 py-2.5">{body}</div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-8">
      {/* Score */}
      <div>
        <h2 className="label">{t.evaluator.score}</h2>
        <div className="mt-2 flex items-end gap-4">
          <span className="tabular font-display text-[5.5rem] font-extrabold leading-[0.8] tracking-tight [font-variation-settings:'opsz'_72]">
            {result.compositeScore}
          </span>
          <div className="pb-1 text-sm">
            <span className="block font-semibold">{t.bands[band.key]}</span>
            <span className="tabular block text-ink-2">
              {t.evaluator.of100} · {t.evaluator.bandRange(band.min, band.max)}
            </span>
            <span className="tabular block font-medium text-ink">
              {previous ? t.evaluator.delta(result.compositeScore - previous.score) : t.evaluator.firstVersion}
            </span>
          </div>
        </div>
        {result.mode === "PARAGRAPH" && <p className="mt-4 text-sm text-ink-2">{t.evaluator.paragraphResult}</p>}
        {stale && (
          <p role="status" className="mt-4 border-l-2 border-rule-strong pl-3 text-sm text-ink">
            {t.evaluator.stale}
          </p>
        )}
      </div>

      {/* What to do next, then what to keep */}
      {listsMissing ? (
        <p className="text-sm text-ink-2">{t.evaluator.listsMissing}</p>
      ) : (
        <>
          {result.topImprovements.length > 0 && (
            <div>
              <h2 className="label">{t.evaluator.priorities}</h2>
              <ol lang="id" className="mt-3 space-y-2.5">
                {result.topImprovements.map((s, i) => (
                  <li key={i} className="grid grid-cols-[20px_1fr] gap-2 text-sm leading-relaxed">
                    <span className="tabular font-semibold text-ink-2">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {result.topStrengths.length > 0 && (
            <div>
              <h2 className="label">{t.evaluator.strengths}</h2>
              <ul lang="id" className="mt-3 space-y-2.5">
                {result.topStrengths.map((s, i) => (
                  <li key={i} className="grid grid-cols-[20px_1fr] gap-2 text-sm leading-relaxed">
                    <Glyph type="STRENGTH" className="mt-1.5 h-3 w-1.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Dimensions on one fixed 0–100 scale */}
      <div>
        <h2 className="label">{t.evaluator.dimensions}</h2>
        <dl className="mt-3 space-y-3">
          {DIMENSIONS.map((d) => {
            const v = result.scores[d];
            return (
              <div key={d} className="grid grid-cols-[96px_1fr_28px] items-center gap-3 text-sm" title={t.dimsHelp[d]}>
                <dt>{t.dims[d]}</dt>
                <dd className="relative h-2 bg-band" aria-hidden="true">
                  {BANDS.slice(0, -1).map((b) => (
                    <span key={b.key} className="absolute inset-y-[-3px] w-px bg-paper" style={{ left: `${b.min}%` }} />
                  ))}
                  <span className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${v}%` }} />
                </dd>
                <dd className="tabular text-right font-semibold">{v}</dd>
              </div>
            );
          })}
        </dl>
      </div>

      {/* Summary, three lines until asked for more */}
      <div>
        <h2 className="label">{t.evaluator.summary}</h2>
        <p lang="id" className={`mt-3 text-sm leading-relaxed text-ink-2 ${summaryOpen ? "" : "line-clamp-3"}`}>
          {result.overallComment}
        </p>
        <button
          type="button"
          aria-expanded={summaryOpen}
          onClick={() => setSummaryOpen((v) => !v)}
          className="mt-1.5 min-h-8 text-sm font-semibold underline"
        >
          {summaryOpen ? t.evaluator.summaryLess : t.evaluator.summaryMore}
        </button>
      </div>

      {/* Sentence notes */}
      <div>
        <h2 className="label">{t.evaluator.notes(ordered.length)}</h2>
        {ordered.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">{t.evaluator.noNotes}</p>
        ) : (
          <ul className="-mx-2 mt-2 divide-y divide-rule">{ordered.map(noteItem)}</ul>
        )}
      </div>

      <p className="flex items-start gap-2 text-xs text-ink-2">
        <Check size={14} strokeWidth={2} className="mt-px shrink-0" aria-hidden="true" />
        {result.voicePreserved ? t.evaluator.voiceKept : t.evaluator.voiceRisk}
      </p>

      <div>
        <h2 className="label mb-3">{t.evaluator.notation}</h2>
        <NotationLegend />
      </div>
    </div>
  );
}
