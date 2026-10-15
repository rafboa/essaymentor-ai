import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UsersService } from './users.service';
import type { PrismaService } from '../prisma/prisma.service';

function setup(create: jest.Mock) {
  return new UsersService({ user: { create } } as unknown as PrismaService);
}

describe('UsersService.create', () => {
  it('stores a bcrypt hash, never the password', async () => {
    const create = jest.fn(({ data }: { data: object }) =>
      Promise.resolve({ id: 'u1', ...data }),
    );
    await setup(create).create('a@b.test', 'A', 'rahasia-sekali');
    const { data } = create.mock.calls[0][0] as {
      data: { passwordHash: string };
    };
    expect(data.passwordHash).toMatch(/^\$2[aby]\$10\$/);
    expect(JSON.stringify(data)).not.toContain('rahasia-sekali');
  });

  it('maps a duplicate email (P2002, including a concurrent sign-up) to 409', async () => {
    const create = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      setup(create).create('a@b.test', 'A', 'rahasia-sekali'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rethrows other database errors', async () => {
    const create = jest.fn().mockRejectedValue(new Error('connection lost'));
    await expect(
      setup(create).create('a@b.test', 'A', 'rahasia-sekali'),
    ).rejects.toThrow('connection lost');
  });
});
