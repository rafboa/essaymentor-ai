import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Logger,
  UseGuards,
  Res,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { EssayService } from './essay.service.js';
import { SubmitEssayDto } from './dto/submit-essay.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../auth/auth-user.js';

// Every route sits behind JwtAuthGuard, so `user` is always a database-backed AuthUser.
// Reads (history, drafts) only count against `default`; the evaluation routes opt back into `llm`.
@SkipThrottle({ auth: true, llm: true, llmIp: true })
@Controller('essay')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EssayController {
  private readonly logger = new Logger(EssayController.name);

  constructor(private readonly essayService: EssayService) {}

  @SkipThrottle({ llm: false, llmIp: false })
  @Throttle({ llm: { limit: 5, ttl: 60000 } })
  @Post('evaluate')
  async evaluate(@Body() dto: SubmitEssayDto, @CurrentUser() user: AuthUser) {
    this.logger.log(`POST /essay/evaluate: user ${user.userId}`);
    return this.essayService.submitAndEvaluate(dto, user.userId);
  }

  @SkipThrottle({ llm: false, llmIp: false })
  @Throttle({ llm: { limit: 5, ttl: 60000 } })
  @Post('evaluate-stream')
  async evaluateStream(
    @Body() dto: SubmitEssayDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    this.logger.log(`POST /essay/evaluate-stream: user ${user.userId}`);

    // Checked before the SSE headers go out, so a wrong draft is a plain 404 response.
    if (dto.draftId) {
      await this.essayService.assertDraftOwner(dto.draftId, user.userId);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      if (!res.writableEnded && !res.destroyed) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    };

    // Client disconnects show up on the response: `req` emits 'close' as soon
    // as its body has been read, long before the stream is done.
    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) {
        this.logger.warn(
          `Koneksi ditutup oleh klien untuk user ${user.userId}. Membatalkan stream...`,
        );
        abortController.abort();
      }
    });

    try {
      await this.essayService.submitAndEvaluateStream(
        dto,
        user.userId,
        send,
        abortController.signal,
      );
    } catch (error) {
      // Headers are already sent, so Nest's exception filter can't respond; report it in-stream.
      this.logger.error(
        `evaluate-stream gagal (user: ${user.userId}): ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
      );
      send('error', {
        message:
          error instanceof HttpException && error.getStatus() < 500
            ? error.message
            : 'Terjadi kesalahan pada server. Silakan coba lagi.',
        draftId: dto.draftId,
      });
    }

    if (!res.writableEnded) {
      res.end();
    }
  }

  @Get('analytics')
  @Roles(Role.ADMIN)
  async getAnalytics() {
    this.logger.log('GET /essay/analytics');
    return this.essayService.getAnalytics();
  }

  @Get('history')
  async getMyDrafts(@CurrentUser() user: AuthUser) {
    this.logger.log(`GET /essay/history: user ${user.userId}`);
    return this.essayService.getDraftsByUser(user.userId);
  }

  @Get(':id')
  async getDraft(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.logger.log(`GET /essay/${id}: user ${user.userId}`);
    return this.essayService.getDraftById(id, user.userId);
  }

  @SkipThrottle({ llm: false, llmIp: false })
  @Throttle({ llm: { limit: 5, ttl: 60000 } })
  @Post(':id/fingerprint')
  async generateFingerprint(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    this.logger.log(`POST /essay/${id}/fingerprint: user ${user.userId}`);
    return this.essayService.generateStyleFingerprint(id, user.userId);
  }
}
