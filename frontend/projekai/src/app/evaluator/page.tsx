"use client";

import { useState, useCallback } from "react";
import { useLanguage } from "../contexts/LanguageContext";

/* ================================================================
   TIPE DATA — sesuai respons dari NestJS POST /essay/evaluate
   ================================================================ */

interface AiScores {
  structure: number;
  tone: number;
  relevance: number;
  originality: number;
  impact: number;
}

interface Annotation {
  sentenceIndex: number;
  type: "STRENGTH" | "SUGGESTION" | "CRITICAL" | "STRUCTURAL" | "TONE";
  message: string;
}

interface EvaluationResult {
  draft: {
    id: string;
    title: string;
    scholarshipTarget: string | null;
    content: string;
    wordCount: number;
    status: string;
    scores: {
      composite: number | null;
      structure: number | null;
      tone: number | null;
      relevance: number | null;
      originality: number | null;
      impact: number | null;
    };
    createdAt: string;
  };
  evaluation: {
    feedbackId: string;
    compositeScore: number;
    scores: AiScores;
    annotations: Annotation[];
    overallComment: string;
    topStrengths: string[];
    topImprovements: string[];
    voicePreserved: boolean;
    processingTimeMs: number;
  };
}

/* ================================================================
   KONSTANTA
   ================================================================ */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const SCHOLARSHIPS = [
  { value: "LPDP RI 2026", label: "🇮🇩 LPDP" },
  { value: "Fulbright", label: "🇺🇸 Fulbright" },
  { value: "Chevening", label: "🇬🇧 Chevening" },
  { value: "Erasmus Mundus", label: "🇪🇺 Erasmus" },
  { value: "DAAD", label: "🇩🇪 DAAD" },
  { value: "AAS (Australia Awards)", label: "🇦🇺 AAS" },
  { value: "Djarum Beasiswa Plus", label: "🏢 Djarum" },
  { value: "Umum / Lainnya", label: "📝 Lainnya" },
];

const ANNOTATION_STYLES: Record<
  Annotation["type"],
  { bg: string; border: string; icon: string; glow: string }
> = {
  STRENGTH: {
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/30",
    icon: "✅",
    glow: "shadow-emerald-500/5",
  },
  SUGGESTION: {
    bg: "bg-amber-500/5",
    border: "border-amber-500/30",
    icon: "💡",
    glow: "shadow-amber-500/5",
  },
  CRITICAL: {
    bg: "bg-red-500/5",
    border: "border-red-500/30",
    icon: "⚠️",
    glow: "shadow-red-500/5",
  },
  STRUCTURAL: {
    bg: "bg-blue-500/5",
    border: "border-blue-500/30",
    icon: "🏗️",
    glow: "shadow-blue-500/5",
  },
  TONE: {
    bg: "bg-purple-500/5",
    border: "border-purple-500/30",
    icon: "🎭",
    glow: "shadow-purple-500/5",
  },
};

/* ================================================================
   KOMPONEN UTAMA
   ================================================================ */

export default function EvaluatorPage() {
  const { t } = useLanguage();
  const [essayContent, setEssayContent] = useState("");
  const [title, setTitle] = useState("");
  const [scholarship, setScholarship] = useState(SCHOLARSHIPS[0].value);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wordCount = essayContent.trim().split(/\s+/).filter(Boolean).length;

  const handleEvaluate = useCallback(async () => {
    if (essayContent.trim().length < 50) {
      setError("Esai terlalu pendek. Minimal 50 karakter untuk dievaluasi.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/essay/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "mvp-user-001",
          title: title.trim() || undefined,
          scholarshipTarget: scholarship,
          content: essayContent.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message || `Server error: ${response.status}`
        );
      }

      const data: EvaluationResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menghubungi server. Pastikan backend berjalan."
      );
    } finally {
      setIsLoading(false);
    }
  }, [essayContent, title, scholarship]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleEvaluate();
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 sm:px-6 py-6 sm:py-10">
      {/* Page Header */}
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2">
          {t.evaluator.title}
        </h1>
        <p className="text-sm text-slate-400">
          {t.evaluator.subtitle}
        </p>
      </div>

      {/* ═══ SPLIT PANEL ═══ */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ─── LEFT: Input ─────────────────────────── */}
        <section className="glass rounded-2xl flex flex-col lg:w-[55%] overflow-hidden">
          {/* Toolbar */}
          <div className="border-b border-border px-5 py-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.evaluator.placeholderTitle}
              className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600 mb-4"
            />

            {/* Scholarship pills */}
            <div className="flex flex-wrap gap-2">
              {SCHOLARSHIPS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setScholarship(s.value)}
                  className={`pill ${
                    scholarship === s.value ? "pill-active" : ""
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text Area */}
          <div className="flex-1 flex flex-col p-5">
            <textarea
              value={essayContent}
              onChange={(e) => setEssayContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.evaluator.placeholderEssay}
              className="custom-scrollbar flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 min-h-[350px] lg:min-h-[450px]"
              spellCheck={false}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
            <div className="flex items-center gap-5 text-xs text-slate-500">
              <span>
                <strong className="font-semibold text-slate-300">{wordCount}</strong> {t.evaluator.words}
              </span>
              <span>
                <strong className="font-semibold text-slate-300">{essayContent.length}</strong> {t.evaluator.chars}
              </span>
              <span className="hidden sm:inline text-slate-600">
                {t.evaluator.hint}
              </span>
            </div>

            <button
              onClick={handleEvaluate}
              disabled={isLoading || essayContent.trim().length < 50}
              className="btn-gradient rounded-lg px-5 py-2.5 text-sm font-semibold flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="flex gap-1">
                    <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-white" />
                    <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-white" />
                    <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  {t.evaluator.btnAnalyzing}
                </>
              ) : (
                `🔍 ${t.evaluator.btnAnalyze}`
              )}
            </button>
          </div>
        </section>

        {/* ─── RIGHT: Results ──────────────────────── */}
        <section className="custom-scrollbar lg:w-[45%] lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto">
          {!isLoading && !result && !error && <EmptyState t={t} />}
          {isLoading && <LoadingSkeleton t={t} />}
          {error && !isLoading && (
            <div className="glass rounded-2xl p-5 border-red-500/20">
              <p className="flex items-start gap-2 text-sm text-red-400">
                <span className="text-lg leading-none">⚠️</span>
                {error}
              </p>
            </div>
          )}
          {result && !isLoading && <ResultPanel result={result} t={t} />}
        </section>
      </div>

      {/* Powered by line */}
      <div className="mt-6 text-center">
        <p className="text-xs text-slate-600">
          {t.evaluator.poweredBy}
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   SUB-KOMPONEN: Empty State
   ================================================================ */

function EmptyState({ t }: { t: any }) {
  return (
    <div className="glass rounded-2xl flex flex-col items-center justify-center px-8 py-20 text-center h-full min-h-[400px]">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500/10">
        <span className="text-3xl">📝</span>
      </div>
      <h2 className="mb-2 text-lg font-semibold text-slate-200">
        {t.evaluator.emptyTitle}
      </h2>
      <p className="max-w-xs text-sm text-slate-500 leading-relaxed">
        {t.evaluator.emptySub}
      </p>
    </div>
  );
}

/* ================================================================
   SUB-KOMPONEN: Loading Skeleton
   ================================================================ */

function LoadingSkeleton({ t }: { t: any }) {
  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Loading header */}
      <div className="glass rounded-2xl p-8 text-center space-y-3">
        <div className="flex justify-center gap-1.5">
          <span className="pulse-dot h-3 w-3 rounded-full bg-primary-400" />
          <span className="pulse-dot h-3 w-3 rounded-full bg-primary-500" />
          <span className="pulse-dot h-3 w-3 rounded-full bg-primary-400" />
        </div>
        <p className="text-sm font-medium text-slate-300">
          {t.evaluator.loadingTitle}
        </p>
        <p className="text-xs text-slate-500">
          {t.evaluator.loadingSub}
        </p>
      </div>

      {/* Score skeleton */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="skeleton h-5 w-32" />
        <div className="skeleton mx-auto h-20 w-20 !rounded-full" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-3 flex-1" />
            </div>
          ))}
        </div>
      </div>

      {/* Annotations skeleton */}
      <div className="glass rounded-2xl p-6 space-y-3">
        <div className="skeleton h-5 w-40" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   SUB-KOMPONEN: Result Panel
   ================================================================ */

function ResultPanel({ result, t }: { result: EvaluationResult, t: any }) {
  const { evaluation } = result;
  const { scores, compositeScore } = evaluation;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* ─── Composite Score ────────────────────────── */}
      <div className="glass rounded-2xl p-6 text-center">
        <p className="mb-4 text-xs font-semibold tracking-wider text-slate-500 uppercase">
          {t.evaluator.scoreLabel}
        </p>
        <div
          className="score-ring mx-auto mb-3"
          style={
            {
              "--progress": compositeScore,
              "--ring-color": getScoreColor(compositeScore),
            } as React.CSSProperties
          }
        >
          <div className="text-center relative z-10">
            <span className="text-3xl font-bold text-slate-100">
              {compositeScore}
            </span>
            <span className="text-sm text-slate-500">/100</span>
          </div>
        </div>
        <p
          className="text-sm font-semibold"
          style={{ color: getScoreColor(compositeScore) }}
        >
          {getScoreLabel(compositeScore)}
        </p>
      </div>

      {/* ─── Score Breakdown ────────────────────────── */}
      <div className="glass rounded-2xl p-6">
        <h3 className="mb-5 text-sm font-semibold text-slate-200">
          📊 {t.evaluator.breakdown}
        </h3>
        <div className="space-y-4">
          <ScoreBar label="Structure" value={scores.structure} icon="🏗️" />
          <ScoreBar label="Tone" value={scores.tone} icon="🎭" />
          <ScoreBar label="Relevance" value={scores.relevance} icon="🎯" />
          <ScoreBar label="Originality" value={scores.originality} icon="✨" />
          <ScoreBar label="Impact" value={scores.impact} icon="💥" />
        </div>
      </div>

      {/* ─── Voice Preservation ──────────────────────── */}
      <div
        className={`glass rounded-2xl p-4 flex items-center gap-3 text-sm ${
          evaluation.voicePreserved
            ? "border-emerald-500/20 bg-emerald-500/5"
            : "border-amber-500/20 bg-amber-500/5"
        }`}
      >
        <span className="text-xl">
          {evaluation.voicePreserved ? "🛡️" : "⚡"}
        </span>
        <span className={evaluation.voicePreserved ? "text-emerald-300" : "text-amber-300"}>
          {evaluation.voicePreserved
            ? t.evaluator.voiceTrue
            : t.evaluator.voiceFalse}
        </span>
      </div>

      {/* ─── Overall Comment ────────────────────────── */}
      <div className="glass rounded-2xl p-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">
          💬 {t.evaluator.summary}
        </h3>
        <p className="text-sm leading-relaxed text-slate-400">
          {evaluation.overallComment}
        </p>
      </div>

      {/* ─── Strengths & Improvements ────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass rounded-2xl p-5 border-emerald-500/10">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-400">
            <span>💪</span> {t.evaluator.strengths}
          </h4>
          <ul className="space-y-2.5">
            {evaluation.topStrengths.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs leading-relaxed text-slate-400"
              >
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="glass rounded-2xl p-5 border-amber-500/10">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-400">
            <span>🚀</span> {t.evaluator.improvements}
          </h4>
          <ul className="space-y-2.5">
            {evaluation.topImprovements.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs leading-relaxed text-slate-400"
              >
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ─── Annotations ────────────────────────────── */}
      {evaluation.annotations.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-200">
            🏷️ {t.evaluator.annotations} ({evaluation.annotations.length})
          </h3>
          <div className="space-y-2.5">
            {evaluation.annotations.map((a, i) => {
              const style = ANNOTATION_STYLES[a.type];
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-xl border-l-[3px] ${style.border} ${style.bg} p-3.5 shadow-sm ${style.glow}`}
                >
                  <span className="mt-0.5 text-base leading-none shrink-0">
                    {style.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {a.type}
                      </span>
                      <span className="text-[11px] text-slate-600">
                        {t.evaluator.sentence} #{a.sentenceIndex + 1}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-300">
                      {a.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   SUB-KOMPONEN: Score Bar
   ================================================================ */

function ScoreBar({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-5 text-center text-sm">{icon}</span>
      <span className="w-24 text-xs text-slate-400">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className="animate-fill absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, ${getScoreColor(value)}, ${getScoreColor(value)}dd)`,
          }}
        />
      </div>
      <span
        className="w-8 text-right text-xs font-bold"
        style={{ color: getScoreColor(value) }}
      >
        {value}
      </span>
    </div>
  );
}

/* ================================================================
   HELPER FUNCTIONS
   ================================================================ */

function getScoreColor(score: number): string {
  if (score >= 81) return "#10b981";
  if (score >= 61) return "#6366f1";
  if (score >= 41) return "#f59e0b";
  if (score >= 21) return "#f97316";
  return "#ef4444";
}

function getScoreLabel(score: number): string {
  if (score >= 91) return "Exceptional 🌟";
  if (score >= 76) return "Sangat Baik";
  if (score >= 51) return "Baik";
  if (score >= 26) return "Cukup";
  return "Perlu Revisi";
}
