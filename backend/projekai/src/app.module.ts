import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserThrottlerGuard, ipTracker } from './auth/user-throttler.guard.js';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { EssayModule } from './essay/essay.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 60,
      },
      {
        // Always per IP, even with a valid token: otherwise each account's
        // token would open a fresh login/register bucket from the same address.
        name: 'auth',
        ttl: 60000,
        limit: 5,
        getTracker: ipTracker,
      },
      {
        // Per user (see UserThrottlerGuard), so classmates behind one NAT
        // don't share a budget.
        name: 'llm',
        ttl: 60000,
        limit: 5,
      },
      {
        // Coarse per-IP ceiling on AI calls, so registering many accounts
        // can't multiply the per-user `llm` budget from one address.
        name: 'llmIp',
        ttl: 60000,
        limit: 30,
        getTracker: ipTracker,
      },
    ]),
    PrismaModule,
    EssayModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: UserThrottlerGuard,
    },
  ],
})
export class AppModule {}
