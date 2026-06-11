// ===========================================================================
// PrismaService — NestJS wrapper untuk Prisma Client
// ===========================================================================
// File ini membungkus PrismaClient dalam sebuah NestJS injectable service
// yang mengelola lifecycle koneksi database secara otomatis:
//   - onModuleInit()    → membuka koneksi saat modul di-bootstrap.
//   - enableShutdownHooks() → menutup koneksi saat app di-terminate (SIGINT/SIGTERM),
//     mencegah connection leak di production.
// ===========================================================================

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // Konfigurasi logging Prisma:
      // - Di development: log semua query untuk debugging.
      // - Di production: hanya log error untuk mengurangi noise.
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'stdout', level: 'query' },
              { emit: 'stdout', level: 'info' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });
  }

  /**
   * Dipanggil otomatis oleh NestJS saat modul yang memuat PrismaService
   * selesai diinisialisasi. Membuka koneksi ke MySQL.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Menghubungkan ke database MySQL...');
    await this.$connect();
    this.logger.log('Koneksi database berhasil.');
  }

  /**
   * Mendaftarkan hook agar Prisma menutup koneksi dengan bersih
   * saat NestJS menerima sinyal shutdown (SIGINT / SIGTERM).
   *
   * Panggil method ini sekali di `main.ts` setelah app dibuat:
   *   const prismaService = app.get(PrismaService);
   *   prismaService.enableShutdownHooks(app);
   */
  async enableShutdownHooks(app: { close: () => Promise<void> }): Promise<void> {
    process.on('beforeExit', async () => {
      this.logger.log('Menutup koneksi database (beforeExit)...');
      await app.close();
    });
  }
}
