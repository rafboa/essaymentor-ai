import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

// Compared against when the email is unknown, so both failure paths spend the
// same bcrypt time and response timing doesn't reveal which emails exist.
const TIMING_DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(
      dto.email,
      dto.fullName,
      dto.password,
    );
    return this.generateToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    const isMatch = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? TIMING_DUMMY_HASH,
    );
    if (!user || !isMatch) {
      throw new UnauthorizedException('Email atau password salah.');
    }

    return this.generateToken(user);
  }

  private generateToken(user: User) {
    // Identity only: role and name are read from the database on each request (JwtStrategy).
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}
