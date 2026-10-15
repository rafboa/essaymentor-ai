import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { UserThrottlerGuard, ipTracker } from './user-throttler.guard';

const SECRET = 'x'.repeat(32);

function setup() {
  const jwt = new JwtService({ secret: SECRET });
  const guard = new UserThrottlerGuard(
    [],
    {} as ThrottlerStorage,
    new Reflector(),
    jwt,
  );
  const tracker = (req: object) =>
    (guard as unknown as { getTracker(r: object): Promise<string> }).getTracker(
      req,
    );
  return { jwt, tracker };
}

const req = (authorization?: string) => ({
  ip: '10.0.0.1',
  headers: authorization ? { authorization } : {},
});

describe('UserThrottlerGuard.getTracker', () => {
  it('keys a verified token by its user', async () => {
    const { jwt, tracker } = setup();
    const token = jwt.sign({ sub: 'u1', email: 'a@b.test' });
    await expect(tracker(req(`Bearer ${token}`))).resolves.toBe('user:u1');
  });

  it('falls back to the IP for a forged token, so a made-up sub cannot mint new buckets', async () => {
    const { tracker } = setup();
    const forged = new JwtService({ secret: 'y'.repeat(32) }).sign({
      sub: 'attacker-123',
    });
    await expect(tracker(req(`Bearer ${forged}`))).resolves.toBe('ip:10.0.0.1');
  });

  it('falls back to the IP for an expired token', async () => {
    const { jwt, tracker } = setup();
    const expired = jwt.sign({
      sub: 'u1',
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    await expect(tracker(req(`Bearer ${expired}`))).resolves.toBe(
      'ip:10.0.0.1',
    );
  });

  it('uses the IP for anonymous requests', async () => {
    const { tracker } = setup();
    await expect(tracker(req())).resolves.toBe('ip:10.0.0.1');
    await expect(tracker(req('Basic abc'))).resolves.toBe('ip:10.0.0.1');
  });
});

describe('ipTracker', () => {
  // Used by the `auth` and `llmIp` tiers: a valid token must not open a new bucket.
  it('keys by IP even when the request carries a valid token', () => {
    const token = new JwtService({ secret: SECRET }).sign({ sub: 'u1' });
    expect(ipTracker(req(`Bearer ${token}`))).toBe('ip:10.0.0.1');
  });
});
