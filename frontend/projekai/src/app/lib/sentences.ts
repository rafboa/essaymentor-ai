// Port of backend/projekai/src/essay/sentences.ts — keep the two identical.
// The backend numbers sentences with this splitter before sending them to the AI,
// so annotation.sentenceIndex refers to these sentences.

const ABBREVIATIONS = new Set([
  'dll', 'dsb', 'dst', 'dkk', 'dr', 'drs', 'prof', 'ir', 'hlm', 'no', 'tn', 'ny', 'sdr',
  'mr', 'mrs', 'ms', 'st', 'vs', 'etc', 'e.g', 'i.e', 'jl', 'kab', 'kec', 'prov',
]);

const TERMINATORS = '.!?…';
const CLOSERS = `"'”’)]»`;

/** Memecah satu paragraf menjadi kalimat. Spasi di sekitar kalimat dibuang. */
function splitParagraph(paragraph: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  let i = 0;

  while (i < paragraph.length) {
    if (TERMINATORS.includes(paragraph[i])) {
      let end = i + 1;
      while (end < paragraph.length && TERMINATORS.includes(paragraph[end])) end++;
      while (end < paragraph.length && CLOSERS.includes(paragraph[end])) end++;

      const atBoundary = end >= paragraph.length || /\s/.test(paragraph[end]);
      const wordBefore = paragraph.slice(start, i).split(/\s+/).pop()?.toLowerCase() ?? '';
      const isAbbreviation = paragraph[i] === '.' && ABBREVIATIONS.has(wordBefore);
      const isDecimal = paragraph[i] === '.' && /\d$/.test(wordBefore) && /^\d/.test(paragraph.slice(end));

      if (atBoundary && !isAbbreviation && !isDecimal) {
        const sentence = paragraph.slice(start, end).trim();
        if (sentence) sentences.push(sentence);
        start = end;
      }
      i = end;
      continue;
    }
    i++;
  }

  const tail = paragraph.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}

/** Paragraf dipisah oleh baris kosong; tiap paragraf dipecah menjadi kalimat. */
export function splitIntoParagraphs(text: string): string[][] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => splitParagraph(p.replace(/\s*\n\s*/g, ' ')))
    .filter((p) => p.length > 0);
}

/** Teks bernomor untuk prompt: "[0] Kalimat pertama." per baris, paragraf dipisah baris kosong. */
export function numberSentences(text: string): { numbered: string; count: number } {
  let index = 0;
  const numbered = splitIntoParagraphs(text)
    .map((paragraph) => paragraph.map((s) => `[${index++}] ${s}`).join('\n'))
    .join('\n\n');
  return { numbered, count: index };
}
