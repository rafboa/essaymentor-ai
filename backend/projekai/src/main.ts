import './env.js';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { jwtSecret } from './auth/jwt-secret.js';

// Last line of defence: Node's default for an unhandled rejection is to exit,
// which would take every user's request down with one stray promise.
process.on('unhandledRejection', (reason) => {
  new Logger('Process').error(
    `Unhandled rejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`,
  );
});

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Fail fast with a readable message instead of a DI stack trace.
  try {
    jwtSecret();
  } catch (error) {
    logger.error(`FATAL: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
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

  // 5. Graceful shutdown on SIGINT/SIGTERM: runs onModuleDestroy, which closes Prisma.
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Aplikasi berjalan di port ${port}`);
}
// A failed start (e.g. the database is down) must exit non-zero so restart policies fire.
bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
