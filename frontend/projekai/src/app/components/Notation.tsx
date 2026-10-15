"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Annotation, AnnotationType } from "../lib/api";
import { splitIntoParagraphs } from "../lib/sentences";
import { useLanguage } from "../contexts/LanguageContext";

/* ── Model ─────────────────────────────────────────────────── */

export interface Beat {
  index: number;
  paragraph: number;
  text: string;
  notes: Annotation[];
}

const FIX_ORDER: AnnotationType[] = ["CRITICAL", "SUGGESTION", "STRUCTURAL", "TONE"];

/** Sentences of the evaluated text, each with the notes that point at it. */
export function buildBeats(text: string, annotations: Annotation[]): Beat[] {
  const beats: Beat[] = [];
  splitIntoParagraphs(text).forEach((sentences, p) =>
    sentences.forEach((s) => beats.push({ index: beats.length, paragraph: p, text: s, notes: [] })),
  );
  for (const a of annotations) beats[a.sentenceIndex]?.notes.push(a);
  return beats;
}

/** The most severe fix on a sentence, if any. */
export function primaryFix(notes: Annotation[]): AnnotationType | null {
  return FIX_ORDER.find((type) => notes.some((n) => n.type === type)) ?? null;
}

/** The underline a sentence carries in the manuscript: its worst fix, else strength. */
export function markOf(notes: Annotation[]): AnnotationType | null {
  return primaryFix(notes) ?? (notes.some((n) => n.type === "STRENGTH") ? "STRENGTH" : null);
}

export function Glyph({ type, className = "" }: { type: AnnotationType; className?: string }) {
  return <span aria-hidden="true" className={`glyph glyph-${type.toLowerCase()} ${className}`} />;
}

/* ── Annotated text with its staff ─────────────────────────── */

interface Span {
  top: number;
  height: number;
}

const MIN_BEAT = 6;

/**
 * Where each sentence sits, measured from the rendered text: a beat starts on
 * the line where its sentence starts and runs to where the next one starts.
 */
function measure(container: HTMLElement, count: number): Span[] {
  const origin = container.getBoundingClientRect().top;
  const raw = Array.from({ length: count }, (_, i) => {
    const el = container.querySelector<HTMLElement>(`[data-beat="${i}"]`);
    const rects = el ? Array.from(el.getClientRects()) : [];
    if (!el || rects.length === 0) return null;
    return {
      start: rects[0].top - origin,
      firstLineEnd: rects[0].bottom - origin,
      end: rects[rects.length - 1].bottom - origin,
      paragraph: Number(el.dataset.paragraph),
    };
  });
  const spans: Span[] = [];
  let floor = 0;
  raw.forEach((r, i) => {
    if (!r) return spans.push({ top: floor, height: 0 });
    const next = raw[i + 1];
    const top = Math.max(r.start, floor);
    // A beat owns at least its first line, even when the next sentence starts on it.
    let end = next && next.paragraph === r.paragraph ? Math.max(next.start, r.firstLineEnd) : r.end;
    if (end - top < MIN_BEAT) end = top + MIN_BEAT;
    spans.push({ top, height: end - top });
    floor = end;
  });
  return spans;
}

interface AnnotatedTextProps {
  beats: Beat[];
  active: number | null;
  onSelect: (index: number, from: "staff" | "text") => void;
  idPrefix: string;
  /** Classes for the text column (font, size, measure). */
  textClassName: string;
  compact?: boolean;
}

/**
 * The manuscript and its staff, read together. Each block on the staff sits
 * level with its sentence; fixes right of the double line, strengths left.
 */
export function AnnotatedText({ beats, active, onSelect, idPrefix, textClassName, compact }: AnnotatedTextProps) {
  const { t } = useLanguage();
  const textRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [layout, setLayout] = useState<{ spans: Span[]; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const update = () => setLayout({ spans: measure(el, beats.length), height: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    document.fonts?.ready.then(update);
    return () => ro.disconnect();
  }, [beats]);

  const paragraphs = beats.reduce<Beat[][]>((acc, b) => {
    (acc[b.paragraph] ??= []).push(b);
    return acc;
  }, []);
  const focusable = active ?? beats.find((b) => b.notes.length)?.index ?? 0;
  const describe = (b: Beat) =>
    b.notes.length ? b.notes.map((n) => `${t.marks[n.type]} — ${n.message}`).join("; ") : b.text.slice(0, 80);
  const move = (from: number, dir: 1 | -1) => {
    const next = Math.min(beats.length - 1, Math.max(0, from + dir));
    buttons.current[next]?.focus();
    onSelect(next, "staff");
  };
  const lane = compact ? "w-3" : "w-5";

  return (
    <div className={`grid ${compact ? "grid-cols-[52px_minmax(0,1fr)] gap-3" : "grid-cols-[76px_minmax(0,1fr)] gap-6"}`}>
      <nav aria-label={t.evaluator.staffLabel} className="relative select-none" style={{ height: layout?.height }}>
        <p className="sr-only">{t.evaluator.staffHelp}</p>
        {layout &&
          beats.map((b) => {
            const span = layout.spans[b.index];
            if (!span) return null;
            const fix = primaryFix(b.notes);
            const strength = b.notes.some((n) => n.type === "STRENGTH");
            const isActive = active === b.index;
            return (
              <button
                key={b.index}
                ref={(el) => {
                  buttons.current[b.index] = el;
                }}
                type="button"
                tabIndex={b.index === focusable ? 0 : -1}
                aria-current={isActive ? "true" : undefined}
                aria-label={t.evaluator.staffSentence(b.index + 1, describe(b))}
                onClick={() => onSelect(b.index, "staff")}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                    e.preventDefault();
                    move(b.index, 1);
                  } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    move(b.index, -1);
                  }
                }}
                className={`absolute inset-x-0 flex items-stretch justify-end outline-offset-0 ${isActive ? "bg-band" : "hover:bg-band"}`}
                style={{ top: span.top, height: span.height }}
              >
                {b.notes.length > 0 && (
                  <span
                    className={`tabular mr-auto self-start pl-0.5 pt-px text-[10px] font-semibold leading-none ${
                      isActive ? "text-ink" : "text-ink-3"
                    }`}
                    aria-hidden="true"
                  >
                    {b.index + 1}
                  </span>
                )}
                <span className={`flex ${lane} justify-end py-0.5 pr-1`}>
                  {strength && <Glyph type="STRENGTH" className="w-1.5 rise" />}
                </span>
                {/* The staff: two lines; the active beat fills solid between them. */}
                <span aria-hidden="true" className={`w-[5px] border-x border-ink ${isActive ? "bg-ink" : ""}`} />
                <span className={`flex ${lane} justify-start py-0.5 pl-1`}>
                  {fix && <Glyph type={fix} className={`${compact ? "w-2" : "w-3.5"} rise ${isActive ? "outline outline-2 outline-offset-1 outline-ink" : ""}`} />}
                </span>
              </button>
            );
          })}
      </nav>

      {/* self-start: the column keeps its own height, so the staff cannot feed back into it. */}
      <div ref={textRef} className={`self-start ${textClassName}`}>
        {paragraphs.map((group, p) => (
          <p key={p} className="mb-6 last:mb-0">
            {group.map((b) => {
              const mark = markOf(b.notes);
              return (
                <span key={b.index}>
                  <span
                    id={`${idPrefix}-s-${b.index}`}
                    data-beat={b.index}
                    data-paragraph={b.paragraph}
                    onClick={mark ? () => onSelect(b.index, "text") : undefined}
                    title={mark ? `${t.evaluator.sentence(b.index + 1)} · ${t.marks[mark]}` : undefined}
                    className={`${mark ? `mark mark-${mark.toLowerCase()}` : "rounded-[2px]"} ${active === b.index ? "beat-active" : ""}`}
                  >
                    {b.text}
                  </span>{" "}
                </span>
              );
            })}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ── Legend ────────────────────────────────────────────────── */

export function NotationLegend({ types = ["CRITICAL", "SUGGESTION", "STRUCTURAL", "TONE", "STRENGTH"] }: { types?: AnnotationType[] }) {
  const { t } = useLanguage();
  return (
    <ul className="grid gap-2.5">
      {types.map((type) => (
        <li key={type} className="grid grid-cols-[14px_1fr] items-center gap-3 text-sm">
          {/* The staff draws a strength as a slim stroke; the legend shows the same shape. */}
          <Glyph type={type} className={type === "STRENGTH" ? "h-4 w-1.5 justify-self-center" : "h-4 w-3.5"} />
          <span>
            <span className={`mark mark-${type.toLowerCase()} cursor-default font-semibold hover:bg-transparent hover:shadow-none`}>
              {t.marks[type]}
            </span>
            <span className="text-ink-2"> — {t.marksHelp[type]}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
