import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { jwtSecret } from './jwt-secret';
import type { UsersService } from '../users/users.service';

const SECRET = 'x'.repeat(32);

describe('jwtSecret', () => {
  const original = process.env.JWT_SECRET;
  afterEach(() => {
    // Assigning undefined would store the string "undefined".
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  });

  it('has no fallback', () => {
    delete process.env.JWT_SECRET;
    expect(() => jwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('rejects a short secret', () => {
    process.env.JWT_SECRET = 'short';
    expect(() => jwtSecret()).toThrow(/32/);
  });
});

describe('JwtStrategy.validate', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });

  function setup(found: object | null) {
    const users = { findById: jest.fn(() => Promise.resolve(found)) };
    return {
      strategy: new JwtStrategy(users as unknown as UsersService),
      users,
    };
  }

  it('takes role and name from the database, not the token', async () => {
    const { strategy, users } = setup({
      id: 'u1',
      email: 'a@b.test',
      fullName: 'Nama Baru',
      role: 'USER',
    });
    // A token minted while the user was ADMIN must not keep that role.
    const user = await strategy.validate({
      sub: 'u1',
      email: 'a@b.test',
      role: 'ADMIN',
    } as never);
    expect(user).toEqual({
      userId: 'u1',
      email: 'a@b.test',
      fullName: 'Nama Baru',
      role: 'USER',
    });
    expect(users.findById).toHaveBeenCalledWith('u1');
  });

  it('rejects a token for a deleted account', async () => {
    const { strategy } = setup(null);
    await expect(strategy.validate({ sub: 'gone' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token without a subject', async () => {
    const { strategy } = setup(null);
    await expect(strategy.validate({})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
