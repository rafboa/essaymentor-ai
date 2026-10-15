import {
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FinishReason } from '@google/generative-ai';
import { EssayService } from './essay.service';
import type { PrismaService } from '../prisma/prisma.service';

const VALID = JSON.stringify({
  scores: {
    structure: 80,
    tone: 70,
    relevance: 90,
    originality: 60,
    impact: 75,
  },
  annotations: [
    { sentenceIndex: 0, type: 'STRENGTH', message: 'Pembuka kuat.' },
  ],
  overallComment: 'Bagus.',
  topStrengths: ['a'],
  topImprovements: ['b'],
  voicePreserved: true,
});
const ESSAY =
  'Kalimat pertama yang cukup panjang. Kalimat kedua juga ada di sini. Kalimat ketiga menutup esai ini.';

function makePrisma() {
  const draftRow = (data: object, id = 'd1') => ({
    id,
    title: 'Judul',
    scholarshipTarget: null,
    content: ESSAY,
    totalWordCount: 15,
    status: 'DRAFT',
    version: 1,
    compositeScore: null,
    structureScore: null,
    toneScore: null,
    relevanceScore: null,
    originalityScore: null,
    impactScore: null,
    createdAt: new Date(0),
    ...data,
  });
  const prisma = {
    essayDraft: {
      findUnique: jest.fn(() => Promise.resolve({ userId: 'u1' })),
      findMany: jest.fn(() => Promise.resolve([])),
      create: jest.fn(async ({ data }: { data: object }) =>
        draftRow(data, 'd-new'),
      ),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: object }) =>
          draftRow(data, where.id),
      ),
    },
    user: {
      // PRO by default: the original tests expect Gemini first.
      findUnique: jest.fn(() =>
        Promise.resolve({
          writingStyleFingerprint: null,
          plan: 'PRO',
          role: 'USER',
        }),
      ),
      update: jest.fn(() => Promise.resolve({})),
    },
    aiFeedback: {
      create: jest.fn(() => Promise.resolve({ id: 'fb1' })),
      count: jest.fn(() => Promise.resolve(3)),
      groupBy: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (fn: (tx: typeof prisma) => unknown) => fn(prisma),
  );
  return prisma;
}

async function* textChunks(
  parts: string[],
  onEach?: () => void,
  failWith?: Error,
) {
  for (const p of parts) {
    onEach?.();
    yield { text: () => p };
  }
  if (failWith) throw failWith;
}

function geminiResponse(finishReason: FinishReason, text = VALID) {
  return {
    text: () => text,
    candidates: [{ finishReason }],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 20,
      thoughtsTokenCount: 5,
      totalTokenCount: 35,
    },
  };
}

function gemini(opts: {
  parts?: string[];
  fail?: Error;
  finishReason?: FinishReason;
  onEach?: () => void;
  responseRejects?: boolean;
}) {
  // Like the SDK: when the stream fails or is aborted, the aggregate promise rejects shortly after.
  const response = () =>
    opts.responseRejects
      ? new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Error reading from the stream')),
            5,
          ),
        )
      : Promise.resolve(geminiResponse(opts.finishReason ?? FinishReason.STOP));
  return {
    getGenerativeModel: () => ({
      generateContentStream: jest.fn(async () => ({
        stream: textChunks(opts.parts ?? [VALID], opts.onEach, opts.fail),
        response: response(),
      })),
      generateContent: jest.fn(async () => {
        if (opts.fail) throw opts.fail;
        return {
          response: geminiResponse(opts.finishReason ?? FinishReason.STOP),
        };
      }),
    }),
  };
}

function groq(opts: { text?: string; fail?: Error } = {}) {
  return {
    chat: {
      completions: {
        create: jest.fn(async (body: { stream?: boolean }) => {
          if (opts.fail) throw opts.fail;
          const text = opts.text ?? VALID;
          if (!body.stream) {
            return {
              choices: [{ message: { content: text } }],
              usage: { prompt_tokens: 11, completion_tokens: 22 },
            };
          }
          return (async function* () {
            yield { choices: [{ delta: { content: text } }] };
            yield {
              choices: [],
              x_groq: { usage: { prompt_tokens: 11, completion_tokens: 22 } },
            };
          })();
        }),
      },
    },
  };
}

function setup(clients: {
  gemini: object;
  groq: object | null;
  deepseek?: object | null;
}) {
  const prisma = makePrisma();
  const service = new EssayService(prisma as unknown as PrismaService);
  // DeepSeek is off unless a test turns it on, so no test reaches a real API.
  Object.assign(service as object, { deepseek: null, ...clients });
  const events: { event: string; data: any }[] = [];
  const emit = (event: string, data: unknown) => events.push({ event, data });
  return { prisma, service, events, emit };
}

const dto = (extra: object = {}) => ({
  content: ESSAY,
  title: 'Judul',
  scholarshipTarget: 'LPDP',
  ...extra,
});

beforeAll(() => Logger.overrideLogger(false));

describe('EssayService.submitAndEvaluateStream', () => {
  it('falls back to Groq with an empty buffer after Gemini fails mid-stream', async () => {
    const g = groq();
    const { service, prisma, events, emit } = setup({
      gemini: gemini({
        parts: ['{"scores": {"structure": 8'],
        fail: new Error('503 overloaded'),
      }),
      groq: g,
    });

    await service.submitAndEvaluateStream(dto(), 'u1', emit);

    // JSON mode without streaming: the documented Groq combination.
    expect(g.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({ response_format: { type: 'json_object' } }),
      expect.anything(),
    );
    expect(g.chat.completions.create.mock.calls[0][0]).not.toHaveProperty(
      'stream',
    );
    expect(events.map((e) => e.event)).not.toContain('error');
    const done = events.find((e) => e.event === 'done');
    expect(done?.data.evaluation.compositeScore).toBe(75);
    expect(prisma.aiFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelVersion: 'openai/gpt-oss-120b',
          promptTokens: 11,
          responseTokens: 22,
        }),
      }),
    );
  });

  it('falls back when Gemini stops on MAX_TOKENS instead of failing at JSON.parse', async () => {
    const { service, events, emit } = setup({
      gemini: gemini({
        parts: ['{"scores": {'],
        finishReason: FinishReason.MAX_TOKENS,
      }),
      groq: groq(),
    });

    await service.submitAndEvaluateStream(dto(), 'u1', emit);

    expect(events.find((e) => e.event === 'done')).toBeDefined();
  });

  it('records Gemini usage with thinking tokens counted as output', async () => {
    const { service, prisma, emit } = setup({
      gemini: gemini({}),
      groq: groq({ fail: new Error('unused') }),
    });

    await service.submitAndEvaluateStream(dto(), 'u1', emit);

    expect(prisma.aiFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelVersion: 'gemini-3.5-flash-lite',
          promptTokens: 10,
          responseTokens: 25,
        }),
      }),
    );
  });

  it('moves the version forward only once an evaluation is saved, under a row lock', async () => {
    const { service, prisma, events, emit } = setup({
      gemini: gemini({}),
      groq: groq(),
    });
    // An existing draft at v4 with 3 earlier evaluations (a failed run once skipped a number).
    const row = prisma.essayDraft.update.getMockImplementation()!;
    prisma.essayDraft.update.mockImplementation(async (args) => ({
      ...(await row(args)),
      version: 4,
      ...args.data,
    }));

    await service.submitAndEvaluateStream(dto({ draftId: 'd1' }), 'u1', emit);

    const updates = prisma.essayDraft.update.mock.calls.map(
      ([arg]) => (arg as { data: object }).data,
    );
    expect(updates[0]).not.toHaveProperty('version'); // prepare() saves text only
    expect(events.find((e) => e.event === 'done')?.data.draft.version).toBe(5);
    // The lock (2nd update) is taken before the count and the insert.
    const lockOrder = prisma.essayDraft.update.mock.invocationCallOrder[1];
    expect(lockOrder).toBeLessThan(
      prisma.aiFeedback.count.mock.invocationCallOrder[0],
    );
    expect(lockOrder).toBeLessThan(
      prisma.aiFeedback.create.mock.invocationCallOrder[0],
    );
  });

  it('keeps a new draft at its initial version for its first evaluation', async () => {
    const { service, prisma, events, emit } = setup({
      gemini: gemini({}),
      groq: groq(),
    });
    prisma.aiFeedback.count.mockResolvedValue(0);

    await service.submitAndEvaluateStream(dto(), 'u1', emit);

    expect(events.find((e) => e.event === 'done')?.data.draft.version).toBe(1);
  });

  it('falls back to Groq when Gemini finishes normally but its JSON is unusable', async () => {
    const { service, prisma, events, emit } = setup({
      gemini: gemini({ parts: ['{"scores": "nope"}'] }),
      groq: groq(),
    });

    await service.submitAndEvaluateStream(dto(), 'u1', emit);

    expect(events.find((e) => e.event === 'done')).toBeDefined();
    expect(prisma.aiFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelVersion: 'openai/gpt-oss-120b',
        }),
      }),
    );
  });

  it('frees the draft and reports its id when saving the evaluation fails', async () => {
    const { service, prisma, events, emit } = setup({
      gemini: gemini({}),
      groq: groq(),
    });
    prisma.$transaction.mockRejectedValueOnce(new Error('deadlock'));

    await service.submitAndEvaluateStream(dto(), 'u1', emit);

    expect(events.at(-1)).toEqual({
      event: 'error',
      data: expect.objectContaining({ draftId: 'd-new' }),
    });
    expect(JSON.stringify(events.at(-1))).not.toContain('deadlock');
    expect(prisma.essayDraft.update).toHaveBeenLastCalledWith({
      where: { id: 'd-new' },
      data: { status: 'DRAFT' },
    });
  });

  it('reads the fingerprint before writing the draft, so a failure there leaves no draft behind', async () => {
    const { service, prisma, emit } = setup({
      gemini: gemini({}),
      groq: groq(),
    });
    prisma.user.findUnique.mockRejectedValueOnce(new Error('db down'));

    await expect(
      service.submitAndEvaluateStream(dto(), 'u1', emit),
    ).rejects.toThrow('db down');
    expect(prisma.essayDraft.create).not.toHaveBeenCalled();
  });

  it('reports an error event, keeps the draft, and leaves the version alone when both providers fail', async () => {
    const { service, prisma, events, emit } = setup({
      gemini: gemini({ parts: [], fail: new Error('503') }),
      groq: groq({ fail: new Error('429') }),
    });

    await service.submitAndEvaluateStream(dto({ draftId: 'd1' }), 'u1', emit);

    expect(events.at(-1)).toEqual({
      event: 'error',
      data: expect.objectContaining({ draftId: 'd1' }),
    });
    expect(prisma.aiFeedback.create).not.toHaveBeenCalled();
    const updates = prisma.essayDraft.update.mock.calls.map(
      ([arg]) => (arg as { data: object }).data,
    );
    expect(updates.every((d) => !('version' in d))).toBe(true);
    expect(updates.at(-1)).toEqual({ status: 'DRAFT' });
  });

  it('refuses a draft owned by someone else before touching it', async () => {
    const { service, prisma, emit } = setup({
      gemini: gemini({}),
      groq: groq(),
    });
    prisma.essayDraft.findUnique.mockResolvedValueOnce({
      userId: 'someone-else',
    });

    await expect(
      service.submitAndEvaluateStream(dto({ draftId: 'd1' }), 'u1', emit),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.essayDraft.update).not.toHaveBeenCalled();
  });

  it('stops quietly and frees the draft when the client disconnects', async () => {
    const abort = new AbortController();
    const { service, prisma, events, emit } = setup({
      gemini: gemini({
        parts: ['{"scores"', ': {}'],
        onEach: () => abort.abort(),
      }),
      groq: groq(),
    });

    await service.submitAndEvaluateStream(dto(), 'u1', emit, abort.signal);

    expect(events.map((e) => e.event)).not.toEqual(
      expect.arrayContaining(['done']),
    );
    expect(events.map((e) => e.event)).not.toEqual(
      expect.arrayContaining(['error']),
    );
    expect(prisma.aiFeedback.create).not.toHaveBeenCalled();
    expect(prisma.essayDraft.update).toHaveBeenLastCalledWith({
      where: { id: 'd-new' },
      data: { status: 'DRAFT' },
    });
  });

  it('inserts essay text containing $-patterns literally into the prompt', async () => {
    const g = gemini({});
    const model = g.getGenerativeModel();
    g.getGenerativeModel = () => model;
    const { service, emit } = setup({ gemini: g, groq: groq() });

    await service.submitAndEvaluateStream(
      dto({ content: "Biaya naik $' persen setiap tahun di kampus kami." }),
      'u1',
      emit,
    );

    const [prompt] = model.generateContentStream.mock.calls[0] as unknown as [
      string,
    ];
    expect(prompt).toContain(
      "[0] Biaya naik $' persen setiap tahun di kampus kami.",
    );
  });
});

describe('EssayService stream failure hygiene', () => {
  const unhandled: unknown[] = [];
  const record = (reason: unknown) => unhandled.push(reason);
  beforeEach(() => {
    unhandled.length = 0;
    process.on('unhandledRejection', record);
  });
  afterEach(() => {
    process.off('unhandledRejection', record);
  });

  // An unhandled rejection kills the Node process: one cancelled request
  // would take the server down for everyone.
  it.each([
    ['the client aborts', { parts: ['{"scores"', ': {}'] }, true],
    [
      'Gemini fails mid-stream',
      { parts: ['{"sc'], fail: new Error('503') },
      false,
    ],
  ])(
    'leaves no unhandled rejection when %s',
    async (_label, geminiOpts, abort) => {
      const ac = new AbortController();
      const { service, emit } = setup({
        gemini: gemini({
          ...geminiOpts,
          responseRejects: true,
          onEach: abort ? () => ac.abort() : undefined,
        }),
        groq: groq(),
      });

      await service.submitAndEvaluateStream(dto(), 'u1', emit, ac.signal);
      await new Promise((r) => setTimeout(r, 30));

      expect(unhandled).toEqual([]);
    },
  );
});

describe('EssayService.submitAndEvaluate', () => {
  it('falls back to Groq when Gemini fails', async () => {
    const { service } = setup({
      gemini: gemini({ fail: new Error('503') }),
      groq: groq(),
    });
    const result = await service.submitAndEvaluate(dto(), 'u1');
    expect(result.evaluation.compositeScore).toBe(75);
  });

  it('falls back to Groq when Gemini returns unusable JSON', async () => {
    const g = gemini({});
    const model = g.getGenerativeModel();
    model.generateContent.mockResolvedValueOnce({
      response: {
        ...geminiResponse(FinishReason.STOP),
        text: () => 'not json',
      },
    });
    g.getGenerativeModel = () => model;
    const { service } = setup({ gemini: g, groq: groq() });
    const result = await service.submitAndEvaluate(dto(), 'u1');
    expect(result.evaluation.compositeScore).toBe(75);
  });

  it('throws a 500 and frees the draft when both providers fail', async () => {
    const { service, prisma } = setup({
      gemini: gemini({ fail: new Error('503') }),
      groq: groq({ fail: new Error('429') }),
    });
    await expect(service.submitAndEvaluate(dto(), 'u1')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(prisma.essayDraft.update).toHaveBeenLastCalledWith({
      where: { id: 'd-new' },
      data: { status: 'DRAFT' },
    });
  });
});

describe('EssayService reads', () => {
  it('history returns only the score fields of each evaluation', async () => {
    const { service, prisma } = setup({ gemini: gemini({}), groq: groq() });
    await service.getDraftsByUser('u1');
    expect(prisma.essayDraft.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        include: {
          aiFeedbacks: expect.objectContaining({
            select: {
              id: true,
              feedbackType: true,
              scores: true,
              createdAt: true,
            },
          }),
        },
      }),
    );
  });

  it('a reopened draft carries the previous whole-essay score, skipping the latest', async () => {
    const { service, prisma } = setup({ gemini: gemini({}), groq: groq() });
    prisma.essayDraft.findUnique.mockResolvedValueOnce({
      id: 'd1',
      userId: 'u1',
      aiFeedbacks: [{ id: 'fb-latest' }],
    } as never);
    prisma.aiFeedback.findFirst.mockResolvedValueOnce({
      scores: { structure: 70 },
    });

    const draft = await service.getDraftById('d1', 'u1');

    expect(prisma.aiFeedback.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          draftId: 'd1',
          feedbackType: 'FULL_ESSAY',
          id: { not: 'fb-latest' },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(draft.previousFullEssay).toEqual({ scores: { structure: 70 } });
  });

  it('a draft never evaluated has no previous score and skips the query', async () => {
    const { service, prisma } = setup({ gemini: gemini({}), groq: groq() });
    prisma.essayDraft.findUnique.mockResolvedValueOnce({
      id: 'd1',
      userId: 'u1',
      aiFeedbacks: [],
    } as never);

    const draft = await service.getDraftById('d1', 'u1');

    expect(draft.previousFullEssay).toBeNull();
    expect(prisma.aiFeedback.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null],
    ['owned by someone else', { id: 'd1', userId: 'other', aiFeedbacks: [] }],
  ])(
    'a %s draft gets the same 404 from read and fingerprint',
    async (_label, row) => {
      const { service, prisma } = setup({ gemini: gemini({}), groq: groq() });
      prisma.essayDraft.findUnique.mockResolvedValue(row as never);

      const read = service.getDraftById('d1', 'u1').catch((e: Error) => e);
      const fp = service
        .generateStyleFingerprint('d1', 'u1')
        .catch((e: Error) => e);
      const [a, b] = await Promise.all([read, fp]);

      for (const e of [a, b]) {
        expect(e).toBeInstanceOf(NotFoundException);
        expect((e as Error).message).toBe(
          'Draft tidak ditemukan atau Anda tidak memiliki akses.',
        );
      }
    },
  );

  it('analytics aggregates per model in the database', async () => {
    const { service, prisma } = setup({ gemini: gemini({}), groq: groq() });
    prisma.aiFeedback.groupBy.mockResolvedValue([
      {
        modelVersion: 'gemini-2.5-flash',
        _count: { _all: 2 },
        _sum: {
          promptTokens: 1_000_000,
          responseTokens: 0,
          processingTimeMs: 3000,
        },
      },
      {
        modelVersion: 'llama-3.3-70b-versatile',
        _count: { _all: 1 },
        _sum: { promptTokens: 0, responseTokens: 500, processingTimeMs: 1500 },
      },
    ]);

    const a = await service.getAnalytics();

    expect(a).toMatchObject({
      totalEvaluations: 3,
      totalPromptTokens: 1_000_000,
      totalResponseTokens: 500,
      totalTokens: 1_000_500,
      averageProcessingTimeMs: 1500,
      modelBreakdown: { 'gemini-2.5-flash': 2, 'llama-3.3-70b-versatile': 1 },
    });
    expect(a.estimatedCostUsd).toBeGreaterThan(0);
  });
});

describe('EssayService fallback chain', () => {
  const geminiDown = () => gemini({ fail: new Error('503') });

  it('tries DeepSeek before Groq, with thinking switched off', async () => {
    const d = groq();
    const g = groq();
    const { service, prisma } = setup({
      gemini: geminiDown(),
      deepseek: d,
      groq: g,
    });

    await service.submitAndEvaluate(dto(), 'u1');

    expect(d.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'deepseek-flash',
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
      }),
      expect.anything(),
    );
    expect(g.chat.completions.create).not.toHaveBeenCalled();
    expect(prisma.aiFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ modelVersion: 'deepseek-flash' }),
      }),
    );
  });

  it('moves on to Groq when DeepSeek rejects the request', async () => {
    const g = groq();
    const { service, prisma } = setup({
      gemini: geminiDown(),
      deepseek: groq({ fail: new Error('401 Authentication Fails') }),
      groq: g,
    });

    await service.submitAndEvaluate(dto(), 'u1');

    expect(g.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'openai/gpt-oss-120b',
        reasoning_effort: 'low',
      }),
      expect.anything(),
    );
    expect(prisma.aiFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ modelVersion: 'openai/gpt-oss-120b' }),
      }),
    );
  });

  it('moves on when DeepSeek answers with empty or unusable content', async () => {
    const { service, prisma } = setup({
      gemini: geminiDown(),
      deepseek: groq({ text: '' }),
      groq: groq(),
    });

    await service.submitAndEvaluate(dto(), 'u1');

    expect(prisma.aiFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ modelVersion: 'openai/gpt-oss-120b' }),
      }),
    );
  });

  it('skips a provider without a key and still answers from the other', async () => {
    const { service, prisma } = setup({
      gemini: geminiDown(),
      deepseek: null,
      groq: groq(),
    });

    await service.submitAndEvaluate(dto(), 'u1');

    expect(prisma.aiFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ modelVersion: 'openai/gpt-oss-120b' }),
      }),
    );
  });

  it('reports a 500 and frees the draft when no fallback is configured', async () => {
    const { service, prisma } = setup({
      gemini: geminiDown(),
      deepseek: null,
      groq: null,
    });

    await expect(service.submitAndEvaluate(dto(), 'u1')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(prisma.essayDraft.update).toHaveBeenLastCalledWith({
      where: { id: 'd-new' },
      data: { status: 'DRAFT' },
    });
  });

  it('fingerprints through the fallbacks when Gemini fails', async () => {
    const fingerprint = JSON.stringify({
      vocabularyLevel: 'Akademis',
      sentenceLengthVariance: 'Bervariasi',
      tone: 'Reflektif',
      quirks: ['kalimat pasif', 'metafora alam'],
    });
    const d = groq({ text: fingerprint });
    const { service, prisma } = setup({
      gemini: geminiDown(),
      deepseek: d,
      groq: groq(),
    });
    prisma.essayDraft.findUnique.mockResolvedValueOnce({
      id: 'd1',
      userId: 'u1',
      content: ESSAY,
    } as never);

    const result = await service.generateStyleFingerprint('d1', 'u1');

    expect(result.tone).toBe('Reflektif');
    expect(d.chat.completions.create).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          writingStyleFingerprint: expect.objectContaining({
            tone: 'Reflektif',
          }),
        },
      }),
    );
  });
});

describe('EssayService routing by access level', () => {
  const asUser = (
    prisma: { user: { findUnique: jest.Mock } },
    plan: 'FREE' | 'PRO',
    role: 'USER' | 'ADMIN' = 'USER',
  ) =>
    prisma.user.findUnique.mockResolvedValue({
      writingStyleFingerprint: null,
      plan,
      role,
    });

  it('sends a FREE user to Groq first and never calls Gemini when Groq answers', async () => {
    const g = gemini({});
    const spy = jest.spyOn(g, 'getGenerativeModel');
    const groqClient = groq();
    const { service, prisma } = setup({
      gemini: g,
      deepseek: groq(),
      groq: groqClient,
    });
    asUser(prisma, 'FREE');

    await service.submitAndEvaluate(dto(), 'u1');

    expect(groqClient.chat.completions.create).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
    expect(prisma.aiFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ modelVersion: 'openai/gpt-oss-120b' }),
      }),
    );
  });

  it('moves a FREE user from Groq to DeepSeek, then to Gemini as the last resort', async () => {
    const deepseek = groq();
    const first = setup({
      gemini: gemini({}),
      deepseek,
      groq: groq({ fail: new Error('429 TPM') }),
    });
    asUser(first.prisma, 'FREE');
    await first.service.submitAndEvaluate(dto(), 'u1');
    expect(first.prisma.aiFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ modelVersion: 'deepseek-flash' }),
      }),
    );

    const last = setup({
      gemini: gemini({}),
      deepseek: groq({ fail: new Error('402') }),
      groq: groq({ fail: new Error('429 TPM') }),
    });
    asUser(last.prisma, 'FREE');
    await last.service.submitAndEvaluate(dto(), 'u1');
    expect(last.prisma.aiFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelVersion: 'gemini-3.5-flash-lite',
        }),
      }),
    );
  });

  it('streams a FREE user through Groq without touching Gemini', async () => {
    const g = gemini({});
    const spy = jest.spyOn(g, 'getGenerativeModel');
    const { service, prisma, events, emit } = setup({
      gemini: g,
      groq: groq(),
    });
    asUser(prisma, 'FREE');

    await service.submitAndEvaluateStream(dto(), 'u1', emit);

    expect(spy).not.toHaveBeenCalled();
    expect(events.find((e) => e.event === 'done')).toBeDefined();
    expect(events.map((e) => e.event)).not.toContain('error');
  });

  it('streams a FREE user through Gemini when every cheap provider fails', async () => {
    const { service, prisma, events, emit } = setup({
      gemini: gemini({}),
      deepseek: groq({ fail: new Error('402') }),
      groq: groq({ fail: new Error('429 TPM') }),
    });
    asUser(prisma, 'FREE');

    await service.submitAndEvaluateStream(dto(), 'u1', emit);

    expect(events.find((e) => e.event === 'done')).toBeDefined();
    expect(prisma.aiFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelVersion: 'gemini-3.5-flash-lite',
        }),
      }),
    );
  });

  it.each([
    ['a PRO user', 'PRO', 'USER'],
    ['an admin on the FREE plan', 'FREE', 'ADMIN'],
  ] as const)('sends %s to Gemini first', async (_label, plan, role) => {
    const groqClient = groq();
    const { service, prisma } = setup({
      gemini: gemini({}),
      groq: groqClient,
    });
    asUser(prisma, plan, role);

    await service.submitAndEvaluate(dto(), 'u1');

    expect(groqClient.chat.completions.create).not.toHaveBeenCalled();
    expect(prisma.aiFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelVersion: 'gemini-3.5-flash-lite',
        }),
      }),
    );
  });

  it('fingerprints a FREE user through Groq first', async () => {
    const fingerprint = JSON.stringify({
      vocabularyLevel: 'Akademis',
      sentenceLengthVariance: 'Bervariasi',
      tone: 'Reflektif',
      quirks: ['kalimat pasif'],
    });
    const g = gemini({});
    const spy = jest.spyOn(g, 'getGenerativeModel');
    const { service, prisma } = setup({
      gemini: g,
      groq: groq({ text: fingerprint }),
    });
    asUser(prisma, 'FREE');
    prisma.essayDraft.findUnique.mockResolvedValueOnce({
      id: 'd1',
      userId: 'u1',
      content: ESSAY,
    } as never);

    const result = await service.generateStyleFingerprint('d1', 'u1');

    expect(result.tone).toBe('Reflektif');
    expect(spy).not.toHaveBeenCalled();
  });
});
