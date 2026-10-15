import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import type { UsersService } from '../users/users.service';

// Pass-through mock, so the spec can see which hash login() compares against.
jest.mock('bcrypt', () => {
  const actual = jest.requireActual('bcrypt');
  return { ...actual, compare: jest.fn(actual.compare) };
});

const SECRET = 'x'.repeat(32);
const user = {
  id: 'u1',
  email: 'a@b.test',
  fullName: 'A',
  role: 'USER',
  passwordHash: bcrypt.hashSync('benar-sekali', 4),
};

function setup(found: typeof user | null) {
  const users = { findByEmail: jest.fn(() => Promise.resolve(found)) };
  const jwt = new JwtService({ secret: SECRET });
  return {
    service: new AuthService(users as unknown as UsersService, jwt),
    jwt,
  };
}

describe('AuthService.login', () => {
  it('returns a verifiable token and the public user fields', async () => {
    const { service, jwt } = setup(user);
    const result = await service.login({
      email: user.email,
      password: 'benar-sekali',
    });
    await expect(jwt.verifyAsync(result.access_token)).resolves.toMatchObject({
      sub: 'u1',
      email: 'a@b.test',
    });
    expect(result.user).toEqual({
      id: 'u1',
      email: 'a@b.test',
      fullName: 'A',
      role: 'USER',
    });
  });

  it('rejects a wrong password', async () => {
    const { service } = setup(user);
    await expect(
      service.login({ email: user.email, password: 'salah' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('runs bcrypt even for an unknown email, with the same message', async () => {
    const { service } = setup(null);
    (bcrypt.compare as jest.Mock).mockClear();
    await expect(
      service.login({ email: 'x@b.test', password: 'apa saja' }),
    ).rejects.toThrow('Email atau password salah.');
    expect(bcrypt.compare).toHaveBeenCalledWith(
      'apa saja',
      expect.stringMatching(/^\$2[aby]\$10\$/),
    );
  });
});
