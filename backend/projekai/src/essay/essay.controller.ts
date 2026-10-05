import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Logger,
  UseGuards,
  UnauthorizedException,
  Res,
  Req,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { EssayService } from './essay.service.js';
import { SubmitEssayDto } from './dto/submit-essay.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('essay')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EssayController {
  private readonly logger = new Logger(EssayController.name);

  constructor(private readonly essayService: EssayService) {}

  @Throttle({ llm: { limit: 5, ttl: 60000 } })
  @Post('evaluate')
  async evaluate(@Body() dto: SubmitEssayDto, @CurrentUser() user: any) {
    if (!user || !user.userId) {
      throw new UnauthorizedException('Anda harus login terlebih dahulu.');
    }

    dto.userId = user.userId;
    this.logger.log(`POST /essay/evaluate: user ${dto.userId}`);
    return this.essayService.submitAndEvaluate(dto);
  }

  @Throttle({ llm: { limit: 5, ttl: 60000 } })
  @Post('evaluate-stream')
  async evaluateStream(
    @Body() dto: SubmitEssayDto,
    @CurrentUser() user: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!user || !user.userId) {
      throw new UnauthorizedException('Anda harus login terlebih dahulu.');
    }

    dto.userId = user.userId;
    this.logger.log(`POST /essay/evaluate-stream: user ${dto.userId}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const abortController = new AbortController();
    req.on('close', () => {
      if (!res.writableEnded) {
        this.logger.warn(`Koneksi ditutup oleh klien untuk user ${user.userId}. Membatalkan stream...`);
        abortController.abort();
      }
    });

    await this.essayService.submitAndEvaluateStream(
      dto,
      (event, data) => {
        if (!res.writableEnded) {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        }
      },
      abortController.signal,
    );

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
  async getMyDrafts(@CurrentUser() user: any) {
    if (!user || !user.userId) {
      throw new UnauthorizedException('Anda harus login terlebih dahulu.');
    }
    this.logger.log(`GET /essay/history: user ${user.userId}`);
    return this.essayService.getDraftsByUser(user.userId);
  }

  @Get(':id')
  async getDraft(@Param('id') id: string, @CurrentUser() user: any) {
    this.logger.log(`GET /essay/${id}`);
    return this.essayService.getDraftById(id, user.userId);
  }

  @Throttle({ llm: { limit: 5, ttl: 60000 } })
  @Post(':id/fingerprint')
  async generateFingerprint(@Param('id') id: string, @CurrentUser() user: any) {
    if (!user || !user.userId) {
      throw new UnauthorizedException('Anda harus login terlebih dahulu.');
    }
    this.logger.log(`POST /essay/${id}/fingerprint: user ${user.userId}`);
    return this.essayService.generateStyleFingerprint(id, user.userId);
  }
}
