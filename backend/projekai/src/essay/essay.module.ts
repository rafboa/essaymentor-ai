// ===========================================================================
// EssayModule — NestJS Module yang mengelompokkan essay feature
// ===========================================================================
// Module ini mendaftarkan EssayController dan EssayService.
// PrismaService sudah tersedia secara global (via PrismaModule @Global()),
// sehingga tidak perlu diimpor di sini.
// ===========================================================================

import { Module } from '@nestjs/common';
import { EssayController } from './essay.controller.js';
import { EssayService } from './essay.service.js';

@Module({
  controllers: [EssayController],
  providers: [EssayService],
  exports: [EssayService],
})
export class EssayModule {}
