import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service.js';
import { SubmitEssayDto } from './dto/submit-essay.dto.js';
import {
  SYSTEM_PROMPT,
  USER_PROMPT_TEMPLATE,
  GENERATION_CONFIG,
  AI_PRICING_CONFIG,
} from './ai.config.js';

// ─── Tipe untuk respons AI yang sudah di-parse (exported untuk TS) ────────

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

@Injectable()
export class EssayService {
  private readonly logger = new Logger(EssayService.name);
  
  // Clients
  private readonly gemini: GoogleGenerativeAI;
  private readonly groq: OpenAI;

  // Models
  private readonly geminiModelName = 'gemini-2.5-flash';
  private readonly groqModelName = 'llama-3.3-70b-versatile';

  constructor(private readonly prisma: PrismaService) {
    // ── Inisialisasi Gemini SDK ───────────────────────────────────────────
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      this.logger.warn('GEMINI_API_KEY tidak ditemukan. Evaluasi utama mungkin gagal.');
    }
    this.gemini = new GoogleGenerativeAI(geminiKey || '');

    // ── Inisialisasi Groq SDK via OpenAI client ───────────────────────────
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      this.logger.warn('GROQ_API_KEY tidak ditemukan. Fallback tidak akan berjalan.');
    }
    this.groq = new OpenAI({
      apiKey: groqKey || '',
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC: Submit esai → evaluasi AI → simpan ke DB → return ke klien
  // ═══════════════════════════════════════════════════════════════════════

  async submitAndEvaluate(dto: SubmitEssayDto) {
    // ── 1. Validasi input ────────────────────────────────────────────────
    if (!dto.content || dto.content.trim().length === 0) {
      throw new BadRequestException('Konten esai tidak boleh kosong.');
    }
    if (!dto.userId || dto.userId.trim().length === 0) {
      throw new BadRequestException('userId wajib diisi.');
    }

    const essayContent = dto.content.trim();
    const wordCount = essayContent.split(/\s+/).length;

    this.logger.log(
      `Menerima esai dari user ${dto.userId} — ${wordCount} kata.`,
    );

    // ── 2. Dapatkan atau Buat Draft ───────────────────────────
    let draft;
    if (dto.draftId) {
      draft = await this.prisma.essayDraft.findUnique({ where: { id: dto.draftId } });
      if (!draft || draft.userId !== dto.userId) {
        throw new BadRequestException('Draft tidak ditemukan atau Anda tidak memiliki akses.');
      }
      draft = await this.prisma.essayDraft.update({
        where: { id: draft.id },
        data: {
          title: dto.title?.trim() || draft.title,
          scholarshipTarget: dto.scholarshipTarget?.trim() || draft.scholarshipTarget,
          content: essayContent,
          status: 'IN_REVIEW',
          totalWordCount: wordCount,
          version: draft.version + 1,
        },
      });
      this.logger.log(`Draft diupdate (v${draft.version}) dengan ID: ${draft.id}`);
    } else {
      draft = await this.prisma.essayDraft.create({
        data: {
          userId: dto.userId,
          title: dto.title?.trim() || 'Esai Tanpa Judul',
          scholarshipTarget: dto.scholarshipTarget?.trim() || null,
          content: essayContent,
          status: 'IN_REVIEW',
          totalWordCount: wordCount,
        },
      });
      this.logger.log(`Draft tersimpan (v1) dengan ID: ${draft.id}`);
    }

    // ── 3. Ambil Fingerprint User ──────────────────────────────────────────
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    const fingerprint = user?.writingStyleFingerprint;
    const fingerprintStr = fingerprint
      ? `\n4. PERHATIKAN Writing Style Fingerprint penulis:\n   - Vocabulary: ${(fingerprint as any).vocabularyLevel}\n   - Sentence Variance: ${(fingerprint as any).sentenceLengthVariance}\n   - Tone: ${(fingerprint as any).tone}\n   - Quirks: ${((fingerprint as any).quirks || []).join(', ')}\n   Pastikan saranmu mempertimbangkan gaya ini.`
      : `\n4. Jika mahasiswa menggunakan gaya bercerita unik yang efektif, pertahankan. Namun jika bertele-tele, sarankan pemangkasan.`;

    const systemPromptWithFingerprint = SYSTEM_PROMPT.replace('{{FINGERPRINT_SECTION}}', fingerprintStr);

    // ── 4. Rakit Prompt ──────────────────────────────────────────────────
    const isParagraph = dto.mode === 'PARAGRAPH';
    const textToEvaluate = (isParagraph && dto.targetText) ? dto.targetText.trim() : essayContent;

    const userPrompt = USER_PROMPT_TEMPLATE
      .replace('{{SCHOLARSHIP_TARGET}}', dto.scholarshipTarget || 'Umum / Tidak ditentukan')
      .replace('{{EVALUATION_MODE}}', isParagraph ? 'EVALUASI 1 PARAGRAF SPESIFIK' : 'EVALUASI FULL ESAI')
      .replace('{{ESSAY_CONTENT}}', textToEvaluate);

    let evaluation: AiEvaluationResponse;
    let rawResponseText: string = '';
    let promptTokenCount = 0;
    let responseTokenCount = 0;
    let processingTimeMs = 0;
    let usedModel = this.geminiModelName;

    // ── 4. Evaluasi dengan Fallback Mechanism ───────────────────────────
    try {
      const startTime = Date.now();
      
      try {
        // --- COBA GEMINI (UTAMA) ---
        this.logger.log('Mencoba evaluasi menggunakan Gemini (Utama)...');
        const model = this.gemini.getGenerativeModel({
          model: this.geminiModelName,
          systemInstruction: systemPromptWithFingerprint,
          generationConfig: {
            temperature: GENERATION_CONFIG.temperature,
            topP: GENERATION_CONFIG.top_p,
            maxOutputTokens: GENERATION_CONFIG.max_tokens,
            responseMimeType: "application/json",
          },
        });

        const result = await model.generateContent(userPrompt);
        rawResponseText = result.response.text();
        usedModel = this.geminiModelName;
        
        // Token counting for Gemini is available in response.usageMetadata
        const usage = result.response.usageMetadata;
        if (usage) {
          promptTokenCount = usage.promptTokenCount;
          responseTokenCount = usage.candidatesTokenCount;
        }

      } catch (geminiError) {
        // --- FALLBACK KE GROQ JIKA GEMINI GAGAL ---
        const errMsg = geminiError instanceof Error ? geminiError.message : String(geminiError);
        this.logger.warn(`Gemini gagal (${errMsg}). Beralih ke Groq (Fallback)...`);

        const groqResult = await this.groq.chat.completions.create({
          model: this.groqModelName,
          messages: [
            { role: 'system', content: systemPromptWithFingerprint },
            { role: 'user', content: userPrompt }
          ],
          ...GENERATION_CONFIG,
        });

        rawResponseText = groqResult.choices[0]?.message?.content || '';
        usedModel = this.groqModelName;

        if (groqResult.usage) {
          promptTokenCount = groqResult.usage.prompt_tokens ?? 0;
          responseTokenCount = groqResult.usage.completion_tokens ?? 0;
        }
      }

      processingTimeMs = Date.now() - startTime;
      this.logger.log(
        `Berhasil menggunakan ${usedModel} dalam ${processingTimeMs}ms ` +
        `(prompt: ${promptTokenCount} token, response: ${responseTokenCount} token)`,
      );

      // ── 5. Parse JSON respons dari AI ─────────────────────────────────
      evaluation = this.parseAiResponse(rawResponseText);
    } catch (error) {
      // Jika KEDUANYA gagal, update status draft kembali ke DRAFT
      await this.prisma.essayDraft.update({
        where: { id: draft.id },
        data: { status: 'DRAFT' },
      });

      this.logger.error(
        `Gagal mengevaluasi esai (Gemini & Groq fail): ${error instanceof Error ? error.message : error}`,
      );
      throw new InternalServerErrorException(
        'Terjadi kesalahan saat mengevaluasi esai. AI Provider sedang sibuk, silakan coba lagi nanti.',
      );
    }

    // ── 6. Simpan feedback AI ke database ────────────────────────────────
    const feedback = await this.prisma.aiFeedback.create({
      data: {
        draftId: draft.id,
        feedbackType: isParagraph ? 'PARAGRAPH' : 'FULL_ESSAY',
        scores: evaluation.scores as object,
        annotations: evaluation.annotations as object[],
        overallComment: evaluation.overallComment,
        voicePreserved: evaluation.voicePreserved,
        modelVersion: usedModel,
        promptTokens: promptTokenCount,
        responseTokens: responseTokenCount,
        processingTimeMs: processingTimeMs,
        // Simpan data mentah hanya di development untuk debugging
        rawPrompt: process.env.NODE_ENV === 'development' ? SYSTEM_PROMPT : null,
        rawResponse: process.env.NODE_ENV === 'development' ? rawResponseText : null,
      },
    });
    this.logger.log(`Feedback tersimpan dengan ID: ${feedback.id} (Model: ${usedModel})`);

    // ── 7. Update skor cache di draft ───────────────────────────────────
    const updatedDraft = await this.prisma.essayDraft.update({
      where: { id: draft.id },
      data: {
        status: 'DRAFT', // Kembalikan ke DRAFT agar bisa diedit lagi
        compositeScore: evaluation.compositeScore,
        structureScore: evaluation.scores.structure,
        toneScore: evaluation.scores.tone,
        relevanceScore: evaluation.scores.relevance,
        originalityScore: evaluation.scores.originality,
        impactScore: evaluation.scores.impact,
      },
    });

    // ── 8. Return gabungan draft + evaluasi ke controller ────────────────
    return {
      draft: {
        id: updatedDraft.id,
        title: updatedDraft.title,
        scholarshipTarget: updatedDraft.scholarshipTarget,
        content: updatedDraft.content,
        wordCount: updatedDraft.totalWordCount,
        status: updatedDraft.status,
        version: updatedDraft.version,
        scores: {
          composite: updatedDraft.compositeScore,
          structure: updatedDraft.structureScore,
          tone: updatedDraft.toneScore,
          relevance: updatedDraft.relevanceScore,
          originality: updatedDraft.originalityScore,
          impact: updatedDraft.impactScore,
        },
        createdAt: updatedDraft.createdAt,
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

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC: Submit esai dengan SSE Streaming respons token demi token
  // ═══════════════════════════════════════════════════════════════════════

  async submitAndEvaluateStream(
    dto: SubmitEssayDto,
    emitEvent: (event: 'status' | 'chunk' | 'done' | 'error', data: any) => void,
    abortSignal?: AbortSignal,
  ) {
    if (!dto.content || dto.content.trim().length === 0) {
      throw new BadRequestException('Konten esai tidak boleh kosong.');
    }
    if (!dto.userId || dto.userId.trim().length === 0) {
      throw new BadRequestException('userId wajib diisi.');
    }

    const essayContent = dto.content.trim();
    const wordCount = essayContent.split(/\s+/).length;

    emitEvent('status', { message: 'Menyiapkan draft esai...' });

    let draft;
    if (dto.draftId) {
      draft = await this.prisma.essayDraft.findUnique({ where: { id: dto.draftId } });
      if (!draft || draft.userId !== dto.userId) {
        throw new BadRequestException('Draft tidak ditemukan atau akses ditolak.');
      }
      draft = await this.prisma.essayDraft.update({
        where: { id: draft.id },
        data: {
          title: dto.title?.trim() || draft.title,
          scholarshipTarget: dto.scholarshipTarget?.trim() || draft.scholarshipTarget,
          content: essayContent,
          status: 'IN_REVIEW',
          totalWordCount: wordCount,
          version: draft.version + 1,
        },
      });
    } else {
      draft = await this.prisma.essayDraft.create({
        data: {
          userId: dto.userId,
          title: dto.title?.trim() || 'Esai Tanpa Judul',
          scholarshipTarget: dto.scholarshipTarget?.trim() || null,
          content: essayContent,
          status: 'IN_REVIEW',
          totalWordCount: wordCount,
        },
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    const fingerprint = user?.writingStyleFingerprint;
    const fingerprintStr = fingerprint
      ? `\n4. PERHATIKAN Writing Style Fingerprint penulis:\n   - Vocabulary: ${(fingerprint as any).vocabularyLevel}\n   - Sentence Variance: ${(fingerprint as any).sentenceLengthVariance}\n   - Tone: ${(fingerprint as any).tone}\n   - Quirks: ${((fingerprint as any).quirks || []).join(', ')}\n   Pastikan saranmu mempertimbangkan gaya ini.`
      : `\n4. Jika mahasiswa menggunakan gaya bercerita unik yang efektif, pertahankan. Namun jika bertele-tele, sarankan pemangkasan.`;

    const systemPromptWithFingerprint = SYSTEM_PROMPT.replace('{{FINGERPRINT_SECTION}}', fingerprintStr);

    const isParagraph = dto.mode === 'PARAGRAPH';
    const textToEvaluate = (isParagraph && dto.targetText) ? dto.targetText.trim() : essayContent;

    const userPrompt = USER_PROMPT_TEMPLATE
      .replace('{{SCHOLARSHIP_TARGET}}', dto.scholarshipTarget || 'Umum / Tidak ditentukan')
      .replace('{{EVALUATION_MODE}}', isParagraph ? 'EVALUASI 1 PARAGRAF SPESIFIK' : 'EVALUASI FULL ESAI')
      .replace('{{ESSAY_CONTENT}}', textToEvaluate);

    let evaluation: AiEvaluationResponse;
    let rawResponseText = '';
    const startTime = Date.now();
    let usedModel = this.geminiModelName;

    try {
      try {
        emitEvent('status', { message: 'Menghubungi Gemini AI (Streaming)...' });
        const model = this.gemini.getGenerativeModel({
          model: this.geminiModelName,
          systemInstruction: systemPromptWithFingerprint,
          generationConfig: {
            temperature: GENERATION_CONFIG.temperature,
            topP: GENERATION_CONFIG.top_p,
            maxOutputTokens: GENERATION_CONFIG.max_tokens,
            responseMimeType: "application/json",
          },
        });

        const streamResult = await model.generateContentStream(userPrompt);
        for await (const chunk of streamResult.stream) {
          if (abortSignal?.aborted) {
            this.logger.warn(`Gemini stream dibatalkan oleh klien (user: ${dto.userId})`);
            await this.prisma.essayDraft.update({
              where: { id: draft.id },
              data: { status: 'DRAFT' },
            });
            return;
          }
          const text = chunk.text();
          rawResponseText += text;
          emitEvent('chunk', { text });
        }
        usedModel = this.geminiModelName;
      } catch (geminiError) {
        if (abortSignal?.aborted) {
          await this.prisma.essayDraft.update({
            where: { id: draft.id },
            data: { status: 'DRAFT' },
          });
          return;
        }

        const errMsg = geminiError instanceof Error ? geminiError.message : String(geminiError);
        this.logger.warn(`Gemini stream gagal (${errMsg}). Fallback ke Groq stream...`);
        emitEvent('status', { message: 'Gemini sibuk, beralih ke Groq AI (Fallback)...' });

        const groqStream = await this.groq.chat.completions.create({
          model: this.groqModelName,
          messages: [
            { role: 'system', content: systemPromptWithFingerprint },
            { role: 'user', content: userPrompt }
          ],
          stream: true,
          ...GENERATION_CONFIG,
        });

        for await (const part of groqStream) {
          if (abortSignal?.aborted) {
            this.logger.warn(`Groq stream dibatalkan oleh klien (user: ${dto.userId})`);
            await this.prisma.essayDraft.update({
              where: { id: draft.id },
              data: { status: 'DRAFT' },
            });
            return;
          }
          const text = part.choices[0]?.delta?.content || '';
          rawResponseText += text;
          emitEvent('chunk', { text });
        }
        usedModel = this.groqModelName;
      }

      if (abortSignal?.aborted) {
        await this.prisma.essayDraft.update({
          where: { id: draft.id },
          data: { status: 'DRAFT' },
        });
        return;
      }

      emitEvent('status', { message: 'Menyusun hasil evaluasi dan menyimpan draft...' });
      evaluation = this.parseAiResponse(rawResponseText);
    } catch (error) {
      await this.prisma.essayDraft.update({
        where: { id: draft.id },
        data: { status: 'DRAFT' },
      });
      emitEvent('error', {
        message: 'Gagal menganalisis esai. AI Provider sedang sibuk, silakan coba lagi.',
      });
      return;
    }

    const processingTimeMs = Date.now() - startTime;
    const promptTokenCount = Math.ceil((systemPromptWithFingerprint.length + userPrompt.length) / 4);
    const responseTokenCount = Math.ceil(rawResponseText.length / 4);

    const feedback = await this.prisma.aiFeedback.create({
      data: {
        draftId: draft.id,
        feedbackType: isParagraph ? 'PARAGRAPH' : 'FULL_ESSAY',
        scores: evaluation.scores as object,
        annotations: evaluation.annotations as object[],
        overallComment: evaluation.overallComment,
        voicePreserved: evaluation.voicePreserved,
        modelVersion: usedModel,
        promptTokens: promptTokenCount,
        responseTokens: responseTokenCount,
        processingTimeMs,
        rawPrompt: process.env.NODE_ENV === 'development' ? SYSTEM_PROMPT : null,
        rawResponse: process.env.NODE_ENV === 'development' ? rawResponseText : null,
      },
    });

    const updatedDraft = await this.prisma.essayDraft.update({
      where: { id: draft.id },
      data: {
        status: 'DRAFT',
        compositeScore: evaluation.compositeScore,
        structureScore: evaluation.scores.structure,
        toneScore: evaluation.scores.tone,
        relevanceScore: evaluation.scores.relevance,
        originalityScore: evaluation.scores.originality,
        impactScore: evaluation.scores.impact,
      },
    });

    emitEvent('done', {
      draft: {
        id: updatedDraft.id,
        title: updatedDraft.title,
        scholarshipTarget: updatedDraft.scholarshipTarget,
        content: updatedDraft.content,
        wordCount: updatedDraft.totalWordCount,
        status: updatedDraft.status,
        version: updatedDraft.version,
        scores: {
          composite: updatedDraft.compositeScore,
          structure: updatedDraft.structureScore,
          tone: updatedDraft.toneScore,
          relevance: updatedDraft.relevanceScore,
          originality: updatedDraft.originalityScore,
          impact: updatedDraft.impactScore,
        },
        createdAt: updatedDraft.createdAt,
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
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC: Ambil semua draft milik seorang user
  // ═══════════════════════════════════════════════════════════════════════

  async getDraftsByUser(userId: string) {
    return this.prisma.essayDraft.findMany({
      where: { userId },
      include: { aiFeedbacks: { orderBy: { createdAt: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC: Ambil satu draft beserta feedback terakhirnya
  // ═══════════════════════════════════════════════════════════════════════

  async getDraftById(draftId: string, userId?: string) {
    const draft = await this.prisma.essayDraft.findUnique({
      where: { id: draftId },
      include: {
        aiFeedbacks: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!draft) {
      throw new NotFoundException(`Draft dengan ID "${draftId}" tidak ditemukan.`);
    }

    if (userId && draft.userId !== userId) {
      throw new ForbiddenException('Anda tidak memiliki wewenang untuk mengakses draft ini.');
    }

    return draft;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: Parse & validasi JSON respons dari AI
  // ═══════════════════════════════════════════════════════════════════════

  private parseAiResponse(rawText: string): AiEvaluationResponse {
    // Bersihkan kemungkinan markdown fence yang dibungkus AI atau teks tambahan di awal/akhir
    let cleanText = rawText.trim();
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
      cleanText = cleanText.slice(firstBrace, lastBrace + 1);
    }
    
    // Parse JSON
    let parsed: AiEvaluationResponse;
    try {
      parsed = JSON.parse(cleanText) as AiEvaluationResponse;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Gagal JSON.parse: ${errMsg}`);
      this.logger.error(`Teks JSON (potongan): ${cleanText.substring(0, 1000)}...`);
      throw new Error(`Respons AI bukan JSON valid: ${errMsg}`);
    }

    // Validasi field wajib
    if (!parsed.scores || typeof parsed.scores !== 'object') {
      throw new Error('Respons AI tidak mengandung field "scores".');
    }

    const requiredScoreFields: (keyof AiScores)[] = [
      'structure',
      'tone',
      'relevance',
      'originality',
      'impact',
    ];
    for (const field of requiredScoreFields) {
      if (typeof parsed.scores[field] !== 'number') {
        throw new Error(`Skor "${field}" tidak ditemukan atau bukan angka.`);
      }
      // Clamp ke range 1-100
      parsed.scores[field] = Math.max(1, Math.min(100, Math.round(parsed.scores[field])));
    }

    // Hitung composite score (rata-rata 5 dimensi)
    const scoreValues = requiredScoreFields.map((f) => parsed.scores[f]);
    parsed.compositeScore = Math.round(
      scoreValues.reduce((sum, v) => sum + v, 0) / scoreValues.length,
    );

    // Validasi annotations
    if (!Array.isArray(parsed.annotations)) {
      parsed.annotations = [];
    }

    // Validasi overallComment
    if (typeof parsed.overallComment !== 'string' || parsed.overallComment.length === 0) {
      parsed.overallComment = 'Evaluasi selesai. Lihat skor dan anotasi untuk detail.';
    }

    // Validasi topStrengths & topImprovements
    if (!Array.isArray(parsed.topStrengths)) {
      parsed.topStrengths = [];
    }
    if (!Array.isArray(parsed.topImprovements)) {
      parsed.topImprovements = [];
    }

    // Validasi voicePreserved
    if (typeof parsed.voicePreserved !== 'boolean') {
      parsed.voicePreserved = true;
    }

    return parsed;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC: Generate Style Fingerprint dari Esai
  // ═══════════════════════════════════════════════════════════════════════

  async generateStyleFingerprint(draftId: string, userId: string) {
    const draft = await this.prisma.essayDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft) {
      throw new NotFoundException(`Draft dengan ID "${draftId}" tidak ditemukan.`);
    }

    if (draft.userId !== userId) {
      throw new ForbiddenException('Anda tidak memiliki wewenang untuk mengakses draft ini.');
    }

    if (!draft.content || draft.content.trim().length < 100) {
      throw new BadRequestException('Esai terlalu pendek untuk dianalisis.');
    }

    const { STYLE_FINGERPRINT_PROMPT } = await import('./ai.config.js');
    const prompt = STYLE_FINGERPRINT_PROMPT.replace('{{ESSAY_CONTENT}}', draft.content);

    try {
      this.logger.log('Men-generate fingerprint gaya penulisan dengan Gemini...');
      const model = this.gemini.getGenerativeModel({
        model: this.geminiModelName,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      });

      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      
      let cleanText = rawText.trim();
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
        cleanText = cleanText.slice(firstBrace, lastBrace + 1);
      }

      const fingerprint = JSON.parse(cleanText);

      await this.prisma.user.update({
        where: { id: userId },
        data: { writingStyleFingerprint: fingerprint as any },
      });

      this.logger.log(`Fingerprint berhasil disimpan untuk user ${userId}`);
      return fingerprint;
    } catch (err) {
      this.logger.error('Gagal generate fingerprint:', err);
      throw new InternalServerErrorException('Gagal menganalisis gaya penulisan.');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC: Monitoring & Analytics (Token usage & cost tracking)
  // ═══════════════════════════════════════════════════════════════════════

  async getAnalytics() {
    const feedbacks = await this.prisma.aiFeedback.findMany({
      select: {
        promptTokens: true,
        responseTokens: true,
        processingTimeMs: true,
        modelVersion: true,
        createdAt: true,
      },
    });

    const totalEvaluations = feedbacks.length;
    let totalPromptTokens = 0;
    let totalResponseTokens = 0;
    let totalProcessingTimeMs = 0;
    const modelBreakdown: Record<string, number> = {};
    let estimatedCostUsd = 0;

    for (const fb of feedbacks) {
      totalPromptTokens += fb.promptTokens;
      totalResponseTokens += fb.responseTokens;
      totalProcessingTimeMs += fb.processingTimeMs;
      modelBreakdown[fb.modelVersion] = (modelBreakdown[fb.modelVersion] || 0) + 1;

      const pricing = AI_PRICING_CONFIG[fb.modelVersion] || AI_PRICING_CONFIG['gemini-2.5-flash'];
      estimatedCostUsd +=
        (fb.promptTokens / 1_000_000) * pricing.inputPerMillionUsd +
        (fb.responseTokens / 1_000_000) * pricing.outputPerMillionUsd;
    }

    const totalTokens = totalPromptTokens + totalResponseTokens;

    return {
      totalEvaluations,
      totalPromptTokens,
      totalResponseTokens,
      totalTokens,
      averageProcessingTimeMs: totalEvaluations > 0 ? Math.round(totalProcessingTimeMs / totalEvaluations) : 0,
      estimatedCostUsd: Number(estimatedCostUsd.toFixed(5)),
      modelBreakdown,
    };
  }
}
