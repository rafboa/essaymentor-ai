import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { PrismaService } from './prisma/prisma.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Aktifkan graceful shutdown agar koneksi MySQL ditutup bersih
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);
  app.enableCors(); // TAMBAHKAN INI!
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(console.error);
