export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export type AnnotationType = "STRENGTH" | "SUGGESTION" | "CRITICAL" | "STRUCTURAL" | "TONE";

export const ANNOTATION_TYPES: AnnotationType[] = ["CRITICAL", "SUGGESTION", "STRUCTURAL", "TONE", "STRENGTH"];

export interface Scores {
  structure: number;
  tone: number;
  relevance: number;
  originality: number;
  impact: number;
}

export const DIMENSIONS: (keyof Scores)[] = ["structure", "tone", "relevance", "originality", "impact"];

export interface Annotation {
  sentenceIndex: number;
  type: AnnotationType;
  message: string;
}

export interface Evaluation {
  feedbackId: string;
  compositeScore: number;
  scores: Scores;
  annotations: Annotation[];
  overallComment: string;
  topStrengths: string[];
  topImprovements: string[];
  voicePreserved: boolean;
  /** Present when this evaluation covered a selected passage, not the whole essay. */
  mode: "FULL_ESSAY" | "PARAGRAPH";
  /** The essay text the annotation indices refer to. */
  evaluatedText: string;
}

export interface FeedbackRecord {
  id: string;
  feedbackType: "FULL_ESSAY" | "PARAGRAPH";
  scores: Scores;
  annotations: Annotation[];
  overallComment: string;
  topStrengths: string[] | null;
  topImprovements: string[] | null;
  voicePreserved: boolean;
  createdAt: string;
}

export interface DraftRecord {
  id: string;
  title: string;
  scholarshipTarget: string | null;
  content: string;
  version: number;
  compositeScore: number | null;
  totalWordCount: number;
  updatedAt: string;
  createdAt: string;
  aiFeedbacks: FeedbackRecord[];
}

/** GET /essay/:id: the latest evaluation in full, plus the previous whole-essay score. */
export interface DraftDetail extends DraftRecord {
  previousFullEssay: Pick<FeedbackRecord, "scores" | "createdAt"> | null;
}

/** GET /essay/history: each evaluation carries only what the list shows. */
export type FeedbackSummary = Pick<FeedbackRecord, "id" | "feedbackType" | "scores" | "createdAt">;
export type DraftSummary = Omit<DraftRecord, "aiFeedbacks"> & { aiFeedbacks: FeedbackSummary[] };

/** Server default title — treated as "no title" in the UI. */
export const DEFAULT_TITLE = "Esai Tanpa Judul";

/** A draft's display name: its title, or its opening words when it has none. */
export function draftName(title: string, content: string): string {
  if (title.trim() && title !== DEFAULT_TITLE) return title.trim();
  const words = content.trim().split(/\s+/).slice(0, 7).join(" ");
  return words ? `${words}…` : "";
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  const raw = body?.message;
  const message = Array.isArray(raw) ? raw.join(" ") : typeof raw === "string" ? raw : "";
  return new ApiError(res.status, message);
}

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw await readError(res);
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readError(res);
  return res.json();
}

/** Opens the evaluation SSE stream. Throws ApiError for non-2xx responses. */
export async function openEvaluationStream(body: unknown, token: string, signal: AbortSignal) {
  const res = await fetch(`${API_BASE}/essay/evaluate-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await readError(res);
  if (!res.body) throw new ApiError(0, "");
  return res.body;
}

export type StreamEvent =
  | { event: "status"; data: { message: string } }
  | { event: "chunk"; data: { text: string } }
  | { event: "done"; data: { draft: { id: string; version: number }; evaluation: Omit<Evaluation, "mode" | "evaluatedText"> } }
  | { event: "error"; data: { message: string; draftId?: string } };

/** Parses an SSE byte stream into events. */
export async function* readEvents(stream: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      let event = "message";
      let data = "";
      for (const line of part.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("event:")) event = trimmed.slice(6).trim();
        else if (trimmed.startsWith("data:")) data = trimmed.slice(5).trim();
      }
      if (!data) continue;
      try {
        yield { event, data: JSON.parse(data) } as StreamEvent;
      } catch {
        // A partial frame; the next chunk completes it.
      }
    }
  }
}

/** Latest full-essay or paragraph feedback on a draft, shaped like a live evaluation. */
export function evaluationFromDraft(draft: DraftRecord): Evaluation | null {
  const fb = draft.aiFeedbacks[0];
  if (!fb) return null;
  return {
    feedbackId: fb.id,
    compositeScore: Math.round(
      DIMENSIONS.reduce((sum, d) => sum + fb.scores[d], 0) / DIMENSIONS.length,
    ),
    scores: fb.scores,
    annotations: fb.annotations ?? [],
    overallComment: fb.overallComment,
    topStrengths: fb.topStrengths ?? [],
    topImprovements: fb.topImprovements ?? [],
    voicePreserved: fb.voicePreserved,
    mode: fb.feedbackType,
    // A passage evaluation's text isn't stored, so its notes can't be placed on sentences.
    evaluatedText: fb.feedbackType === "PARAGRAPH" ? "" : draft.content,
  };
}
