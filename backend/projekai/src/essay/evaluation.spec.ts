import { parseEvaluation, extractJsonObject } from './evaluation';

const valid = {
  scores: {
    structure: 80,
    tone: 70,
    relevance: 90,
    originality: 60,
    impact: 75,
  },
  annotations: [
    { sentenceIndex: 0, type: 'STRENGTH', message: 'Pembuka kuat.' },
    { sentenceIndex: 2, type: 'CRITICAL', message: 'Tidak jelas.' },
  ],
  overallComment: 'Bagus.',
  topStrengths: ['a'],
  topImprovements: ['b'],
  voicePreserved: true,
};

describe('parseEvaluation', () => {
  it('computes the composite itself and keeps valid annotations', () => {
    const r = parseEvaluation(
      JSON.stringify({ ...valid, compositeScore: 99 }),
      3,
    );
    expect(r.compositeScore).toBe(75);
    expect(r.annotations).toHaveLength(2);
  });

  it('strips a markdown fence and surrounding chatter', () => {
    const r = parseEvaluation(
      'Berikut hasilnya:\n```json\n' + JSON.stringify(valid) + '\n```',
      3,
    );
    expect(r.scores.relevance).toBe(90);
  });

  it('clamps and rounds scores to 1..100', () => {
    const r = parseEvaluation(
      JSON.stringify({
        ...valid,
        scores: { ...valid.scores, tone: 140, impact: -3, originality: 59.6 },
      }),
      3,
    );
    expect(r.scores).toMatchObject({ tone: 100, impact: 1, originality: 60 });
  });

  it('drops annotations that point past the last sentence, or are malformed', () => {
    const r = parseEvaluation(
      JSON.stringify({
        ...valid,
        annotations: [
          ...valid.annotations,
          { sentenceIndex: 3, type: 'TONE', message: 'out of range' },
          { sentenceIndex: 1.5, type: 'TONE', message: 'not an integer' },
          { sentenceIndex: 1, type: 'PRAISE', message: 'unknown type' },
          { sentenceIndex: 1, type: 'TONE', message: '   ' },
        ],
      }),
      3,
    );
    expect(r.annotations.map((a) => a.sentenceIndex)).toEqual([0, 2]);
  });

  it('defaults missing optional fields', () => {
    const r = parseEvaluation(JSON.stringify({ scores: valid.scores }), 1);
    expect(r).toMatchObject({
      annotations: [],
      topStrengths: [],
      topImprovements: [],
      voicePreserved: true,
    });
    expect(r.overallComment.length).toBeGreaterThan(0);
  });

  it('rejects text that is not JSON', () => {
    expect(() => parseEvaluation('{"scores": {"structure": 80', 1)).toThrow(
      /bukan JSON valid/,
    );
  });

  it('rejects a missing or non-numeric score', () => {
    expect(() =>
      parseEvaluation(
        JSON.stringify({ ...valid, scores: { ...valid.scores, tone: '70' } }),
        3,
      ),
    ).toThrow(/tone/);
    expect(() =>
      parseEvaluation(JSON.stringify({ overallComment: 'x' }), 3),
    ).toThrow(/scores/);
  });

  // The H1 failure mode: Gemini's partial JSON followed by Groq's complete JSON.
  it('cannot parse a partial answer glued onto a complete one', () => {
    const glued = '{"scores": {"structure": 8' + JSON.stringify(valid);
    expect(() => parseEvaluation(glued, 3)).toThrow();
  });
});

describe('extractJsonObject', () => {
  it('returns the text unchanged when there is no object', () => {
    expect(extractJsonObject('  nope ')).toBe('nope');
  });
});
