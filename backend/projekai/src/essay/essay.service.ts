import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  FinishReason,
  GoogleGenerativeAI,
  type EnhancedGenerateContentResponse,
  type UsageMetadata,
} from '@google/generative-ai';
import OpenAI from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import type { AiFeedback, EssayDraft, Plan, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SubmitEssayDto } from './dto/submit-essay.dto.js';
import { numberSentences } from './sentences.js';
import {
  parseEvaluation,
  extractJsonObject,
  type AiEvaluationResponse,
} from './evaluation.js';
import {
  fillTemplate,
  fingerprintSection,
  sanitizeFingerprint,
  type StyleFingerprint,
} from './prompt.js';
import {
  SYSTEM_PROMPT,
  USER_PROMPT_TEMPLATE,
  STYLE_FINGERPRINT_PROMPT,
  GENERATION_CONFIG,
  GEMINI_MAX_OUTPUT_TOKENS,
  GEMINI_MODEL,
  DEEPSEEK_MODEL,
  DEEPSEEK_EXTRA_BODY,
  GROQ_MODEL,
  GROQ_EXTRA_BODY,
  AI_PRICING_CONFIG,
} from './ai.config.js';

export type {
  AiScores,
  AiAnnotation,
  AiEvaluationResponse,
} from './evaluation.js';

export type StreamEvent = 'status' | 'chunk' | 'done' | 'error';
export type EmitEvent = (event: StreamEvent, data: unknown) => void;

/** A draft saved and its prompts assembled, ready to send to a model. */
interface PreparedRun {
  draft: EssayDraft;
  systemPrompt: string;
  userPrompt: string;
  isParagraph: boolean;
  sentenceCount: number;
  /** Limited access (FREE plan, not an admin): the cheap provider goes first. */
  limited: boolean;
}

interface Completion {
  text: string;
  model: string;
  promptTokens: number;
  responseTokens: number;
  // Parsed inside each provider attempt, so unusable JSON from one provider moves on to the next.
  evaluation: AiEvaluationResponse;
}

// The API reports thinking tokens; this SDK version's types predate the field.
type GeminiUsage = UsageMetadata & { thoughtsTokenCount?: number };

const DRAFT_NOT_FOUND = 'Draft tidak ditemukan atau Anda tidak memiliki akses.';

const estimateTokens = (text: string) => Math.ceil(text.length / 4);

type ChatMessage = { role: 'system' | 'user'; content: string };

type FallbackName = 'DeepSeek' | 'Groq';
/** Full-access accounts: Gemini first, then these. */
const DEFAULT_ORDER: FallbackName[] = ['DeepSeek', 'Groq'];
/** Limited accounts: these first, Gemini only as the last resort. */
const LIMITED_ORDER: FallbackName[] = ['Groq', 'DeepSeek'];

/** FREE accounts are limited; admins never are. An unknown user is treated as limited. */
const isLimited = (user: { plan: Plan; role: Role } | null) =>
  !user || (user.role !== 'ADMIN' && user.plan === 'FREE');

interface ProviderResult<T> {
  text: string;
  model: string;
  promptTokens: number;
  responseTokens: number;
  parsed: T;
}

/** Cuts a failure down to one line for logs and for the combined error. */
const describe = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 200);

@Injectable()
export class EssayService {
  private readonly logger = new Logger(EssayService.name);

  // Clients
  private readonly gemini: GoogleGenerativeAI;
  // OpenAI-compatible fallbacks; null when the API key is missing.
  private readonly deepseek: OpenAI | null;
  private readonly groq: OpenAI | null;

  private readonly geminiModelName = GEMINI_MODEL;

  constructor(private readonly prisma: PrismaService) {
    // ── Inisialisasi Gemini SDK ───────────────────────────────────────────
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      this.logger.warn(
        'GEMINI_API_KEY tidak ditemukan. Evaluasi utama mungkin gagal.',
      );
    }
    this.gemini = new GoogleGenerativeAI(geminiKey || '');

    this.deepseek = this.openAiClient(
      'DEEPSEEK_API_KEY',
      'https://api.deepseek.com',
    );
    this.groq = this.openAiClient(
      'GROQ_API_KEY',
      'https://api.groq.com/openai/v1',
    );
  }

  private openAiClient(envName: string, baseURL: string): OpenAI | null {
    const apiKey = process.env[envName];
    if (!apiKey) {
      this.logger.warn(`${envName} tidak ditemukan. Provider ini dilewati.`);
      return null;
    }
    // One retry, and a bound on each call, so a stuck provider cannot hold
    // the request long enough to starve the next one in the chain.
    return new OpenAI({ apiKey, baseURL, maxRetries: 1, timeout: 60_000 });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC: Submit esai → evaluasi AI → simpan ke DB → return ke klien
  // ═══════════════════════════════════════════════════════════════════════

  async submitAndEvaluate(dto: SubmitEssayDto, userId: string) {
    const run = await this.prepare(dto, userId);
    const startTime = Date.now();

    let completion: Completion;
    try {
      completion = await this.complete(run);
    } catch (error) {
      await this.markIdle(run.draft.id);
      this.logger.error(
        `Gagal mengevaluasi esai (semua provider gagal): ${error instanceof Error ? error.message : error}`,
      );
      throw new InternalServerErrorException(
        'Terjadi kesalahan saat mengevaluasi esai. AI Provider sedang sibuk, silakan coba lagi nanti.',
      );
    }

    return this.persist(run, completion, Date.now() - startTime);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC: Submit esai dengan SSE Streaming respons token demi token
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Model failures are reported as an `error` event. Anything thrown (bad
   * draft, database) is for the caller, which has already sent SSE headers
   * and must turn it into an `error` event itself.
   */
  async submitAndEvaluateStream(
    dto: SubmitEssayDto,
    userId: string,
    emitEvent: EmitEvent,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    emitEvent('status', { message: 'Menyiapkan draft esai...' });
    const run = await this.prepare(dto, userId);
    const startTime = Date.now();

    let completion: Completion | null;
    try {
      completion = await this.streamCompletion(run, emitEvent, abortSignal);
    } catch (error) {
      await this.markIdle(run.draft.id);
      if (abortSignal?.aborted) {
        this.logger.warn(`Stream dibatalkan oleh klien (user: ${userId})`);
        return;
      }
      this.logger.error(
        `Evaluasi stream gagal (user: ${userId}): ${error instanceof Error ? error.message : String(error)}`,
      );
      emitEvent('error', {
        message:
          'Gagal menganalisis esai. AI Provider sedang sibuk, silakan coba lagi.',
        // The draft already exists; the client retries against it instead of creating another.
        draftId: run.draft.id,
      });
      return;
    }
    if (!completion) {
      this.logger.warn(`Stream dibatalkan oleh klien (user: ${userId})`);
      await this.markIdle(run.draft.id);
      return;
    }

    emitEvent('status', {
      message: 'Menyusun hasil evaluasi dan menyimpan draft...',
    });
    let result: Awaited<ReturnType<EssayService['persist']>>;
    try {
      result = await this.persist(run, completion, Date.now() - startTime);
    } catch (error) {
      // persist() already freed the draft; report it in-stream with the id so a retry reuses it.
      this.logger.error(
        `Gagal menyimpan evaluasi (user: ${userId}): ${error instanceof Error ? error.message : String(error)}`,
      );
      emitEvent('error', {
        message: 'Gagal menyimpan hasil evaluasi. Silakan coba lagi.',
        draftId: run.draft.id,
      });
      return;
    }
    emitEvent('done', result);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC: Ambil semua draft milik seorang user
  // ═══════════════════════════════════════════════════════════════════════

  async getDraftsByUser(userId: string) {
    // The list only needs each evaluation's scores; full annotations and
    // comments come with GET /essay/:id.
    return this.prisma.essayDraft.findMany({
      where: { userId },
      include: {
        aiFeedbacks: {
          select: {
            id: true,
            feedbackType: true,
            scores: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC: Ambil satu draft beserta feedback terakhirnya
  // ═══════════════════════════════════════════════════════════════════════

  async getDraftById(draftId: string, userId: string) {
    const draft = await this.prisma.essayDraft.findUnique({
      where: { id: draftId },
      include: {
        aiFeedbacks: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    // One answer for "missing" and "not yours", so draft ids can't be probed.
    if (!draft || draft.userId !== userId) {
      throw new NotFoundException(DRAFT_NOT_FOUND);
    }

    // The whole-essay evaluation before the latest one, so a reopened draft
    // can show its score change (only the latest feedback is sent in full).
    const latestId = draft.aiFeedbacks[0]?.id;
    const previousFullEssay = latestId
      ? await this.prisma.aiFeedback.findFirst({
          where: { draftId, feedbackType: 'FULL_ESSAY', id: { not: latestId } },
          orderBy: { createdAt: 'desc' },
          select: { scores: true, createdAt: true },
        })
      : null;

    return { ...draft, previousFullEssay };
  }

  /** Throws a 404 unless the draft exists and belongs to the user (one message for both, so ids can't be probed). */
  async assertDraftOwner(draftId: string, userId: string): Promise<void> {
    const draft = await this.prisma.essayDraft.findUnique({
      where: { id: draftId },
      select: { userId: true },
    });
    if (!draft || draft.userId !== userId) {
      throw new NotFoundException(DRAFT_NOT_FOUND);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC: Generate Style Fingerprint dari Esai
  // ═══════════════════════════════════════════════════════════════════════

  async generateStyleFingerprint(draftId: string, userId: string) {
    const draft = await this.prisma.essayDraft.findUnique({
      where: { id: draftId },
    });

    // One answer for "missing" and "not yours", so draft ids can't be probed.
    if (!draft || draft.userId !== userId) {
      throw new NotFoundException(DRAFT_NOT_FOUND);
    }

    if (!draft.content || draft.content.trim().length < 100) {
      throw new BadRequestException('Esai terlalu pendek untuk dianalisis.');
    }

    const prompt = fillTemplate(STYLE_FINGERPRINT_PROMPT, {
      ESSAY_CONTENT: draft.content,
    });

    // Stored, then placed in every later system prompt: keep only known, bounded fields.
    const parseFingerprint = (text: string): StyleFingerprint => {
      const parsed = sanitizeFingerprint(JSON.parse(extractJsonObject(text)));
      if (!parsed) throw new Error('Fingerprint tidak valid.');
      return parsed;
    };

    let fingerprint: StyleFingerprint;
    try {
      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, role: true },
      });
      const limited = isLimited(owner);
      const viaGemini = async () => {
        const model = this.gemini.getGenerativeModel({
          model: this.geminiModelName,
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        });
        const result = await model.generateContent(prompt);
        return parseFingerprint(result.response.text());
      };
      const viaFallbacks = async (order: FallbackName[]) =>
        (
          await this.fallbackChat(
            [{ role: 'user', content: prompt }],
            parseFingerprint,
            undefined,
            order,
          )
        ).parsed;

      this.logger.log(
        `Men-generate fingerprint gaya penulisan (${limited ? 'akses terbatas' : 'Gemini'} dulu)...`,
      );
      try {
        fingerprint = limited
          ? await viaFallbacks(LIMITED_ORDER)
          : await viaGemini();
      } catch (firstError) {
        this.logger.warn(
          `Fingerprint gagal di penyedia pertama (${describe(firstError)}). Mencoba penyedia lain...`,
        );
        fingerprint = limited
          ? await viaGemini()
          : await viaFallbacks(DEFAULT_ORDER);
      }
    } catch (err) {
      this.logger.error('Gagal generate fingerprint:', err);
      throw new InternalServerErrorException(
        'Gagal menganalisis gaya penulisan.',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { writingStyleFingerprint: { ...fingerprint } },
    });

    this.logger.log(`Fingerprint berhasil disimpan untuk user ${userId}`);
    return fingerprint;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC: Monitoring & Analytics (Token usage & cost tracking)
  // ═══════════════════════════════════════════════════════════════════════

  async getAnalytics() {
    const groups = await this.prisma.aiFeedback.groupBy({
      by: ['modelVersion'],
      _count: { _all: true },
      _sum: {
        promptTokens: true,
        responseTokens: true,
        processingTimeMs: true,
      },
    });

    let totalEvaluations = 0;
    let totalPromptTokens = 0;
    let totalResponseTokens = 0;
    let totalProcessingTimeMs = 0;
    let estimatedCostUsd = 0;
    const modelBreakdown: Record<string, number> = {};

    for (const g of groups) {
      const prompt = g._sum.promptTokens ?? 0;
      const response = g._sum.responseTokens ?? 0;
      totalEvaluations += g._count._all;
      totalPromptTokens += prompt;
      totalResponseTokens += response;
      totalProcessingTimeMs += g._sum.processingTimeMs ?? 0;
      modelBreakdown[g.modelVersion] = g._count._all;

      const pricing =
        AI_PRICING_CONFIG[g.modelVersion] || AI_PRICING_CONFIG[GEMINI_MODEL];
      estimatedCostUsd +=
        (prompt / 1_000_000) * pricing.inputPerMillionUsd +
        (response / 1_000_000) * pricing.outputPerMillionUsd;
    }

    return {
      totalEvaluations,
      totalPromptTokens,
      totalResponseTokens,
      totalTokens: totalPromptTokens + totalResponseTokens,
      averageProcessingTimeMs:
        totalEvaluations > 0
          ? Math.round(totalProcessingTimeMs / totalEvaluations)
          : 0,
      estimatedCostUsd: Number(estimatedCostUsd.toFixed(5)),
      modelBreakdown,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════════════════════════════

  /** Saves the text (new draft, or the user's existing one) and assembles both prompts. */
  private async prepare(
    dto: SubmitEssayDto,
    userId: string,
  ): Promise<PreparedRun> {
    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Konten esai tidak boleh kosong.');
    }
    const totalWordCount = content.split(/\s+/).length;
    this.logger.log(
      `Menerima esai dari user ${userId} — ${totalWordCount} kata.`,
    );

    // Read before the draft is written, so a failure here leaves nothing IN_REVIEW.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { writingStyleFingerprint: true, plan: true, role: true },
    });

    // The version is not bumped here; persist() sets it once an evaluation succeeds.
    let draft: EssayDraft;
    if (dto.draftId) {
      await this.assertDraftOwner(dto.draftId, userId);
      draft = await this.prisma.essayDraft.update({
        where: { id: dto.draftId },
        data: {
          title: dto.title?.trim() || undefined,
          scholarshipTarget: dto.scholarshipTarget?.trim() || undefined,
          content,
          status: 'IN_REVIEW',
          totalWordCount,
        },
      });
    } else {
      draft = await this.prisma.essayDraft.create({
        data: {
          userId,
          title: dto.title?.trim() || 'Esai Tanpa Judul',
          scholarshipTarget: dto.scholarshipTarget?.trim() || null,
          content,
          status: 'IN_REVIEW',
          totalWordCount,
        },
      });
    }

    const isParagraph = dto.mode === 'PARAGRAPH';
    const passage = isParagraph ? dto.targetText?.trim() : undefined;
    const { numbered, count } = numberSentences(passage || content);

    return {
      draft,
      isParagraph,
      sentenceCount: count,
      limited: isLimited(user),
      systemPrompt: fillTemplate(SYSTEM_PROMPT, {
        FINGERPRINT_SECTION: fingerprintSection(
          sanitizeFingerprint(user?.writingStyleFingerprint),
        ),
      }),
      userPrompt: fillTemplate(USER_PROMPT_TEMPLATE, {
        SCHOLARSHIP_TARGET:
          dto.scholarshipTarget?.trim() || 'Umum / Tidak ditentukan',
        EVALUATION_MODE: isParagraph
          ? 'EVALUASI 1 PARAGRAF SPESIFIK'
          : 'EVALUASI FULL ESAI',
        ESSAY_CONTENT: numbered,
      }),
    };
  }

  private geminiModel(systemInstruction: string) {
    return this.gemini.getGenerativeModel({
      model: this.geminiModelName,
      systemInstruction,
      generationConfig: {
        temperature: GENERATION_CONFIG.temperature,
        topP: GENERATION_CONFIG.top_p,
        maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
      },
    });
  }

  /**
   * Logs why Gemini stopped and what it spent. Throws unless it finished
   * normally, so a truncated answer (MAX_TOKENS) or a blocked one falls back
   * to the fallbacks instead of failing at JSON.parse.
   */
  private geminiUsage(response: EnhancedGenerateContentResponse): {
    promptTokens: number;
    responseTokens: number;
  } {
    const finishReason = response.candidates?.[0]?.finishReason;
    // 2.5 models report thinking separately; it is billed as output and counts against maxOutputTokens.
    const usage: GeminiUsage | undefined = response.usageMetadata;
    const thinking = usage?.thoughtsTokenCount ?? 0;
    this.logger.log(
      `Gemini selesai: finishReason=${finishReason} prompt=${usage?.promptTokenCount ?? '?'} ` +
        `output=${usage?.candidatesTokenCount ?? '?'} thinking=${thinking}`,
    );
    if (finishReason !== FinishReason.STOP) {
      throw new Error(
        `Gemini berhenti sebelum selesai (finishReason=${finishReason}).`,
      );
    }
    return {
      promptTokens: usage?.promptTokenCount ?? 0,
      responseTokens: (usage?.candidatesTokenCount ?? 0) + thinking,
    };
  }

  /**
   * Non-streaming completion. Full-access accounts: Gemini, then the
   * fallbacks. Limited accounts: the cheap fallbacks first, Gemini last.
   */
  private async complete(run: PreparedRun): Promise<Completion> {
    if (run.limited) {
      try {
        this.logger.log('Akses terbatas: mencoba penyedia murah lebih dulu...');
        return await this.fallbackComplete(run, undefined, LIMITED_ORDER);
      } catch (error) {
        this.logger.warn(
          `Penyedia murah gagal (${describe(error)}). Beralih ke Gemini...`,
        );
        return this.geminiComplete(run);
      }
    }
    try {
      return await this.geminiComplete(run);
    } catch (geminiError) {
      this.logger.warn(
        `Gemini gagal (${describe(geminiError)}). Beralih ke fallback...`,
      );
      return this.fallbackComplete(run);
    }
  }

  private async geminiComplete(run: PreparedRun): Promise<Completion> {
    this.logger.log('Mencoba evaluasi menggunakan Gemini...');
    const result = await this.geminiModel(run.systemPrompt).generateContent(
      run.userPrompt,
    );
    const tokens = this.geminiUsage(result.response);
    const text = result.response.text();
    return {
      text,
      model: this.geminiModelName,
      ...tokens,
      evaluation: parseEvaluation(text, run.sentenceCount),
    };
  }

  /** The fallback providers that have an API key, in the order given. */
  private fallbackProviders(order: FallbackName[]) {
    const all = {
      DeepSeek: {
        client: this.deepseek,
        model: DEEPSEEK_MODEL,
        extra: DEEPSEEK_EXTRA_BODY,
      },
      Groq: { client: this.groq, model: GROQ_MODEL, extra: GROQ_EXTRA_BODY },
    };
    return order.flatMap((name) => {
      const { client, ...rest } = all[name];
      return client ? [{ name, client, ...rest }] : [];
    });
  }

  /**
   * Tries each fallback in turn until one returns usable output. Deliberately
   * not streamed: JSON mode combined with streaming is undocumented for these
   * providers, and a fallback must not depend on an untested combination.
   * `parse` runs inside each attempt, so unusable JSON moves on to the next
   * provider instead of failing the request.
   */
  private async fallbackChat<T>(
    messages: ChatMessage[],
    parse: (text: string) => T,
    signal?: AbortSignal,
    order: FallbackName[] = DEFAULT_ORDER,
  ): Promise<ProviderResult<T>> {
    const providers = this.fallbackProviders(order);
    if (providers.length === 0) {
      throw new Error('Tidak ada provider fallback yang dikonfigurasi.');
    }
    const failures: string[] = [];
    for (const provider of providers) {
      try {
        const result = await provider.client.chat.completions.create(
          {
            model: provider.model,
            messages,
            ...GENERATION_CONFIG,
            ...provider.extra,
          } as ChatCompletionCreateParamsNonStreaming,
          { signal },
        );
        const text = result.choices[0]?.message?.content || '';
        const parsed = parse(text);
        return {
          text,
          model: provider.model,
          promptTokens:
            result.usage?.prompt_tokens ??
            estimateTokens(messages.map((m) => m.content).join('')),
          responseTokens:
            result.usage?.completion_tokens ?? estimateTokens(text),
          parsed,
        };
      } catch (error) {
        if (signal?.aborted) throw error;
        this.logger.warn(`${provider.name} gagal (${describe(error)}).`);
        failures.push(`${provider.name}: ${describe(error)}`);
      }
    }
    throw new Error(`Semua provider fallback gagal (${failures.join('; ')}).`);
  }

  private async fallbackComplete(
    run: PreparedRun,
    signal?: AbortSignal,
    order: FallbackName[] = DEFAULT_ORDER,
  ): Promise<Completion> {
    const { parsed, ...rest } = await this.fallbackChat(
      [
        { role: 'system', content: run.systemPrompt },
        { role: 'user', content: run.userPrompt },
      ],
      (text) => parseEvaluation(text, run.sentenceCount),
      signal,
      order,
    );
    return { ...rest, evaluation: parsed };
  }

  /** Gemini, streamed chunk by chunk. Null when the client aborted. */
  private async geminiStream(
    run: PreparedRun,
    emitEvent: EmitEvent,
    signal?: AbortSignal,
  ): Promise<Completion | null> {
    emitEvent('status', { message: 'Menghubungi Gemini AI (Streaming)...' });
    const streamResult = await this.geminiModel(
      run.systemPrompt,
    ).generateContentStream(run.userPrompt, { signal });
    // The SDK's aggregate `response` rejects when the stream fails or is
    // aborted. On those paths nothing awaits it, and an unhandled rejection
    // terminates the Node process, so mark it handled up front.
    streamResult.response.catch(() => undefined);
    let text = '';
    for await (const chunk of streamResult.stream) {
      if (signal?.aborted) break;
      const part = chunk.text();
      text += part;
      emitEvent('chunk', { text: part });
    }
    if (signal?.aborted) return null;
    const tokens = this.geminiUsage(await streamResult.response);
    return {
      text,
      model: this.geminiModelName,
      ...tokens,
      evaluation: parseEvaluation(text, run.sentenceCount),
    };
  }

  /** A fallback answer, announced like a stream so the client can show progress. */
  private async streamFallback(
    run: PreparedRun,
    emitEvent: EmitEvent,
    order: FallbackName[],
    signal?: AbortSignal,
  ): Promise<Completion | null> {
    // A fresh request: a failed provider's partial JSON is never glued onto this one's.
    const completion = await this.fallbackComplete(run, signal, order);
    if (signal?.aborted) return null;
    // The client only uses chunks as a progress count.
    emitEvent('chunk', { text: completion.text });
    return completion;
  }

  /**
   * Streaming completion, in the same order as `complete`. Null when the
   * client aborted.
   */
  private async streamCompletion(
    run: PreparedRun,
    emitEvent: EmitEvent,
    signal?: AbortSignal,
  ): Promise<Completion | null> {
    if (run.limited) {
      try {
        emitEvent('status', { message: 'Menghubungi AI...' });
        return await this.streamFallback(run, emitEvent, LIMITED_ORDER, signal);
      } catch (error) {
        if (signal?.aborted) throw error;
        this.logger.warn(
          `Penyedia murah gagal (${describe(error)}). Beralih ke Gemini...`,
        );
        return this.geminiStream(run, emitEvent, signal);
      }
    }
    try {
      return await this.geminiStream(run, emitEvent, signal);
    } catch (geminiError) {
      if (signal?.aborted) throw geminiError;
      this.logger.warn(
        `Gemini stream gagal (${describe(geminiError)}). Beralih ke fallback...`,
      );
      emitEvent('status', {
        message: 'Gemini sibuk, beralih ke AI cadangan (Fallback)...',
      });
      return this.streamFallback(run, emitEvent, DEFAULT_ORDER, signal);
    }
  }

  /** Puts a draft back to editable after a failed or cancelled run. */
  private async markIdle(draftId: string): Promise<void> {
    try {
      await this.prisma.essayDraft.update({
        where: { id: draftId },
        data: { status: 'DRAFT' },
      });
    } catch (error) {
      this.logger.error(
        `Gagal mengembalikan status draft ${draftId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Saves the evaluation and the draft's cached scores together, and returns
   * the client payload. On failure the draft is freed and the error rethrown.
   */
  private async persist(
    run: PreparedRun,
    completion: Completion,
    processingTimeMs: number,
  ) {
    const { evaluation } = completion;
    this.logger.log(
      `Berhasil menggunakan ${completion.model} dalam ${processingTimeMs}ms ` +
        `(prompt: ${completion.promptTokens} token, response: ${completion.responseTokens} token)`,
    );
    const isDev = process.env.NODE_ENV === 'development';

    let saved: { feedback: AiFeedback; draft: EssayDraft };
    try {
      saved = await this.prisma.$transaction(async (tx) => {
        // Locking the draft row first serialises concurrent evaluations of one
        // draft, so the count below sees every evaluation already committed.
        const locked = await tx.essayDraft.update({
          where: { id: run.draft.id },
          data: { status: 'DRAFT' },
        });
        const earlier = await tx.aiFeedback.count({
          where: { draftId: run.draft.id },
        });
        const feedback = await tx.aiFeedback.create({
          data: {
            draftId: run.draft.id,
            feedbackType: run.isParagraph ? 'PARAGRAPH' : 'FULL_ESSAY',
            topStrengths: evaluation.topStrengths,
            topImprovements: evaluation.topImprovements,
            scores: { ...evaluation.scores },
            annotations: evaluation.annotations.map((a) => ({ ...a })),
            overallComment: evaluation.overallComment,
            voicePreserved: evaluation.voicePreserved,
            modelVersion: completion.model,
            promptTokens: completion.promptTokens,
            responseTokens: completion.responseTokens,
            processingTimeMs,
            // Simpan data mentah hanya di development untuk debugging
            rawPrompt: isDev ? run.systemPrompt : null,
            rawResponse: isDev ? completion.text : null,
          },
        });
        // Only a saved evaluation moves the version, and only forward: the
        // first one keeps the draft's initial version, each later one adds 1.
        const version = earlier === 0 ? locked.version : locked.version + 1;
        const draft = await tx.essayDraft.update({
          where: { id: run.draft.id },
          data: {
            status: 'DRAFT',
            version,
            compositeScore: evaluation.compositeScore,
            structureScore: evaluation.scores.structure,
            toneScore: evaluation.scores.tone,
            relevanceScore: evaluation.scores.relevance,
            originalityScore: evaluation.scores.originality,
            impactScore: evaluation.scores.impact,
          },
        });
        return { feedback, draft };
      });
    } catch (error) {
      await this.markIdle(run.draft.id);
      throw error;
    }
    const { feedback, draft } = saved;
    this.logger.log(
      `Feedback tersimpan dengan ID: ${feedback.id} (v${draft.version}, model: ${completion.model})`,
    );

    return this.toResult(draft, feedback, evaluation, processingTimeMs);
  }

  private toResult(
    draft: EssayDraft,
    feedback: AiFeedback,
    evaluation: AiEvaluationResponse,
    processingTimeMs: number,
  ) {
    return {
      draft: {
        id: draft.id,
        title: draft.title,
        scholarshipTarget: draft.scholarshipTarget,
        content: draft.content,
        wordCount: draft.totalWordCount,
        status: draft.status,
        version: draft.version,
        scores: {
          composite: draft.compositeScore,
          structure: draft.structureScore,
          tone: draft.toneScore,
          relevance: draft.relevanceScore,
          originality: draft.originalityScore,
          impact: draft.impactScore,
        },
        createdAt: draft.createdAt,
      },
      evaluation: {
        feedbackId: feedback.id,
        compositeScore: evaluation.compositeScore,
        scores: evaluation.scores,
        annotations: evaluation.annotations,
        overallComment: evaluation.overallComment,
        topStrengths: evaluation.topStrengths,
        topImprovements: evaluation.topImprovements,
        voicePreserved: evaluation.voicePreserved,
        processingTimeMs,
      },
    };
  }
}
