import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { JwtPayload } from './auth-user.js';

/** Tracker for tiers that must stay per IP whatever the request carries. */
export const ipTracker = (req: Record<string, any>): string =>
  `ip:${String(req.ip)}`;

/**
 * Counts signed-in requests per user instead of per IP. Campus Wi-Fi and
 * mobile CGNAT put many students behind one address, so an IP key would let
 * one class exhaust the `llm` tier for everyone. Invalid tokens count per IP,
 * and the `auth` and `llmIp` tiers override this with `ipTracker`.
 *
 * The token is verified, not just decoded: an unverified `sub` would let a
 * client mint a fresh bucket per request.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwt: JwtService,
  ) {
    super(options, storage, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const headers = req.headers as Record<string, unknown> | undefined;
    const header = headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      try {
        const payload = await this.jwt.verifyAsync<JwtPayload>(header.slice(7));
        if (payload.sub) return `user:${payload.sub}`;
      } catch {
        // Invalid or expired token: fall through to the IP.
      }
    }
    return ipTracker(req);
  }
}
