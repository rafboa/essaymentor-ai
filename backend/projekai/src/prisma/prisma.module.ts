// ===========================================================================
// PrismaModule — Global NestJS Module untuk akses database
// ===========================================================================
// Module ini didaftarkan sebagai @Global() sehingga PrismaService bisa
// di-inject di modul manapun tanpa perlu mengimpor PrismaModule secara
// eksplisit di setiap modul (cukup sekali di AppModule).
// ===========================================================================

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
