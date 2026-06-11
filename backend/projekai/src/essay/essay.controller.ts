// ===========================================================================
// EssayController — REST API endpoints untuk modul Essay
// ===========================================================================
// Endpoints:
//   POST /essay/evaluate  → Terima esai, evaluasi via Gemini, simpan, return.
//   GET  /essay/user/:userId → Ambil semua draft milik user.
//   GET  /essay/:id        → Ambil satu draft beserta feedback terakhir.
// ===========================================================================

import { Controller, Post, Get, Body, Param, Logger } from '@nestjs/common';
import { EssayService } from './essay.service.js';
import { SubmitEssayDto } from './dto/submit-essay.dto.js';

@Controller('essay')
export class EssayController {
  private readonly logger = new Logger(EssayController.name);

  constructor(private readonly essayService: EssayService) {}

  /**
   * POST /essay/evaluate
   *
   * Endpoint utama — menerima teks esai dari frontend, mengirimnya ke
   * Gemini untuk dievaluasi, menyimpan draft + feedback ke MySQL,
   * lalu mengembalikan hasilnya ke klien.
   *
   * Request body (JSON):
   * {
   *   "userId": "clx1abc...",
   *   "title": "Esai LPDP Saya",              // opsional
   *   "scholarshipTarget": "LPDP RI 2026",     // opsional
   *   "content": "Saat saya berusia 12 tahun..."
   * }
   */
  @Post('evaluate')
  async evaluate(@Body() dto: SubmitEssayDto) {
    this.logger.log(`POST /essay/evaluate — user: ${dto.userId}`);
    return this.essayService.submitAndEvaluate(dto);
  }

  /**
   * GET /essay/user/:userId
   *
   * Mengambil semua draft esai milik seorang user, diurutkan dari
   * yang terakhir diperbarui. Setiap draft menyertakan feedback AI-nya.
   */
  @Get('user/:userId')
  async getUserDrafts(@Param('userId') userId: string) {
    this.logger.log(`GET /essay/user/${userId}`);
    return this.essayService.getDraftsByUser(userId);
  }

  /**
   * GET /essay/:id
   *
   * Mengambil satu draft berdasarkan ID, beserta feedback AI terakhir.
   */
  @Get(':id')
  async getDraft(@Param('id') id: string) {
    this.logger.log(`GET /essay/${id}`);
    return this.essayService.getDraftById(id);
  }
}
