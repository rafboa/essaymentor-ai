import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { PrismaService } from './prisma/prisma.service.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Validasi keamanan JWT_SECRET pada environment produksi
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'essaymentor-super-secret-key') {
      logger.error('FATAL: JWT_SECRET wajib diatur dengan rahasia aman di environment produksi.');
      process.exit(1);
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 1. Percayai reverse proxy untuk resolusi IP akurat (Railway, Vercel, Nginx)
  app.set('trust proxy', 1);

  // 2. HTTP Security Headers
  app.use(helmet());

  // 3. Strict CORS
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3001';
  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // 4. Global Input Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 5. Graceful shutdown Prisma
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Aplikasi berjalan di port ${port}`);
}
bootstrap().catch(console.error);
