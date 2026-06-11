// ===========================================================================
// EssayService — Orchestrator utama: Prisma ↔ Gemini/Groq ↔ Response
// ===========================================================================
// Alur kerja method `submitAndEvaluate()`:
//   1. Validasi input dasar.
//   2. Simpan draft esai ASLI ke tabel essay_drafts (via Prisma).
//   3. Rakit prompt kontekstual (system + user prompt).
//   4. Kirim ke API Gemini (sebagai AI Utama).
//   5. Jika Gemini error (quota/503), fallback otomatis ke Groq (Llama).
//   6. Parse & validasi JSON respons.
//   7. Simpan hasil evaluasi ke tabel ai_feedbacks (via Prisma).
//   8. Update skor cache di essay_drafts.
//   9. Kembalikan draft + feedback ke controller → frontend.
// ===========================================================================

import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service.js';
import { SubmitEssayDto } from './dto/submit-essay.dto.js';
import {
  SYSTEM_PROMPT,
  USER_PROMPT_TEMPLATE,
  GENERATION_CONFIG,
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

    // ── 1.5. Ensure user exists (Khusus MVP) ────────────────────────────
    await this.prisma.user.upsert({
      where: { id: dto.userId },
      update: {},
      create: {
        id: dto.userId,
        email: `${dto.userId}@essaymentor.ai`,
        fullName: 'Mahasiswa MVP',
        passwordHash: 'dummy_hash_for_mvp',
      },
    });

    // ── 2. Simpan draft esai ASLI ke database ───────────────────────────
    const draft = await this.prisma.essayDraft.create({
      data: {
        userId: dto.userId,
        title: dto.title?.trim() || 'Esai Tanpa Judul',
        scholarshipTarget: dto.scholarshipTarget?.trim() || null,
        content: essayContent,
        status: 'IN_REVIEW',
        totalWordCount: wordCount,
      },
    });
    this.logger.log(`Draft tersimpan dengan ID: ${draft.id}`);

    // ── 3. Rakit Prompt ──────────────────────────────────────────────────
    const userPrompt = USER_PROMPT_TEMPLATE
      .replace('{{SCHOLARSHIP_TARGET}}', dto.scholarshipTarget || 'Umum / Tidak ditentukan')
      .replace('{{ESSAY_CONTENT}}', essayContent);

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
          systemInstruction: SYSTEM_PROMPT,
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
            { role: 'system', content: SYSTEM_PROMPT },
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
        feedbackType: 'FULL_ESSAY',
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

  async getDraftById(draftId: string) {
    const draft = await this.prisma.essayDraft.findUnique({
      where: { id: draftId },
      include: {
        aiFeedbacks: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!draft) {
      throw new BadRequestException(`Draft dengan ID "${draftId}" tidak ditemukan.`);
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
}
