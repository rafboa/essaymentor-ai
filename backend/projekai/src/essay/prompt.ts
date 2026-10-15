/**
 * Fills `{{KEY}}` slots. Values are inserted literally: a replacement *string*
 * passed to String.replace would expand `$'`, `` $` `` and `$&`, so an essay
 * containing "$'" would splice the rest of the template into itself.
 */
export function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (slot, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : slot,
  );
}

export interface StyleFingerprint {
  vocabularyLevel: string;
  sentenceLengthVariance: string;
  tone: string;
  quirks: string[];
}

const FIELD_MAX = 80;
const QUIRKS_MAX = 5;

// One line, bounded: the fingerprint is LLM output derived from the user's own
// essay and is later placed in the system prompt.
const cleanField = (v: unknown): string =>
  typeof v === 'string'
    ? v.replace(/\s+/g, ' ').trim().slice(0, FIELD_MAX)
    : '';

/** Returns a fingerprint with only known, bounded string fields, or null if nothing usable. */
export function sanitizeFingerprint(raw: unknown): StyleFingerprint | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const fingerprint: StyleFingerprint = {
    vocabularyLevel: cleanField(r.vocabularyLevel),
    sentenceLengthVariance: cleanField(r.sentenceLengthVariance),
    tone: cleanField(r.tone),
    quirks: (Array.isArray(r.quirks) ? r.quirks : [])
      .map(cleanField)
      .filter(Boolean)
      .slice(0, QUIRKS_MAX),
  };
  const hasAny =
    fingerprint.vocabularyLevel ||
    fingerprint.sentenceLengthVariance ||
    fingerprint.tone ||
    fingerprint.quirks.length;
  return hasAny ? fingerprint : null;
}

export function fingerprintSection(
  fingerprint: StyleFingerprint | null,
): string {
  if (!fingerprint) {
    return `\n4. Jika mahasiswa menggunakan gaya bercerita unik yang efektif, pertahankan. Namun jika bertele-tele, sarankan pemangkasan.`;
  }
  return (
    `\n4. PERHATIKAN Writing Style Fingerprint penulis:` +
    `\n   - Vocabulary: ${fingerprint.vocabularyLevel || '-'}` +
    `\n   - Sentence Variance: ${fingerprint.sentenceLengthVariance || '-'}` +
    `\n   - Tone: ${fingerprint.tone || '-'}` +
    `\n   - Quirks: ${fingerprint.quirks.join(', ') || '-'}` +
    `\n   Pastikan saranmu mempertimbangkan gaya ini.`
  );
}
