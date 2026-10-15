// Parsing and validation of the model's JSON. Pure, so it is unit-tested directly.

export interface AiScores {
  structure: number;
  tone: number;
  relevance: number;
  originality: number;
  impact: number;
}

export interface AiAnnotation {
  sentenceIndex: number;
  type: 'STRENGTH' | 'SUGGESTION' | 'CRITICAL' | 'STRUCTURAL' | 'TONE';
  message: string;
}

export interface AiEvaluationResponse {
  scores: AiScores;
  compositeScore: number;
  annotations: AiAnnotation[];
  overallComment: string;
  topStrengths: string[];
  topImprovements: string[];
  voicePreserved: boolean;
}

const SCORE_FIELDS: (keyof AiScores)[] = [
  'structure',
  'tone',
  'relevance',
  'originality',
  'impact',
];
const ANNOTATION_TYPES: AiAnnotation['type'][] = [
  'STRENGTH',
  'SUGGESTION',
  'CRITICAL',
  'STRUCTURAL',
  'TONE',
];

/** Strips a markdown fence or chatter around the outermost JSON object. */
export function extractJsonObject(rawText: string): string {
  const text = rawText.trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  return first !== -1 && last >= first ? text.slice(first, last + 1) : text;
}

/**
 * @param sentenceCount number of `[n]` sentences sent to the model; annotations
 *   pointing past it are dropped, since the client would have no sentence to anchor them to.
 */
export function parseEvaluation(
  rawText: string,
  sentenceCount: number,
): AiEvaluationResponse {
  const cleanText = extractJsonObject(rawText);
  let parsed: AiEvaluationResponse;
  try {
    parsed = JSON.parse(cleanText) as AiEvaluationResponse;
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Respons AI bukan JSON valid: ${errMsg} — potongan: ${cleanText.slice(0, 300)}`,
    );
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !parsed.scores ||
    typeof parsed.scores !== 'object'
  ) {
    throw new Error('Respons AI tidak mengandung field "scores".');
  }

  for (const field of SCORE_FIELDS) {
    if (
      typeof parsed.scores[field] !== 'number' ||
      !Number.isFinite(parsed.scores[field])
    ) {
      throw new Error(`Skor "${field}" tidak ditemukan atau bukan angka.`);
    }
    // Clamp ke range 1-100
    parsed.scores[field] = Math.max(
      1,
      Math.min(100, Math.round(parsed.scores[field])),
    );
  }

  // Composite = rata-rata 5 dimensi, dihitung di sini, bukan dipercaya dari model.
  parsed.compositeScore = Math.round(
    SCORE_FIELDS.reduce((sum, f) => sum + parsed.scores[f], 0) /
      SCORE_FIELDS.length,
  );

  parsed.annotations = (
    Array.isArray(parsed.annotations) ? parsed.annotations : []
  ).filter(
    (a) =>
      a &&
      ANNOTATION_TYPES.includes(a.type) &&
      Number.isInteger(a.sentenceIndex) &&
      a.sentenceIndex >= 0 &&
      a.sentenceIndex < sentenceCount &&
      typeof a.message === 'string' &&
      a.message.trim().length > 0,
  );

  if (
    typeof parsed.overallComment !== 'string' ||
    parsed.overallComment.length === 0
  ) {
    parsed.overallComment =
      'Evaluasi selesai. Lihat skor dan anotasi untuk detail.';
  }

  const toStringList = (v: unknown) =>
    Array.isArray(v)
      ? v.filter(
          (s): s is string => typeof s === 'string' && s.trim().length > 0,
        )
      : [];
  parsed.topStrengths = toStringList(parsed.topStrengths);
  parsed.topImprovements = toStringList(parsed.topImprovements);

  if (typeof parsed.voicePreserved !== 'boolean') {
    parsed.voicePreserved = true;
  }

  return parsed;
}
