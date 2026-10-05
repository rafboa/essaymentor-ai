import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(email: string, fullName: string, passwordPlain: string) {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email sudah terdaftar.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);

    return this.prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash,
      },
    });
  }
}
