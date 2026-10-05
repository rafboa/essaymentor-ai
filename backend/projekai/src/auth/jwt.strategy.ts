import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Dalam MVP kita pakai token dari Authorization Header (Bearer Token)
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Gunakan JWT_SECRET dari .env, fallback untuk dev saja
      secretOrKey: process.env.JWT_SECRET || 'essaymentor-super-secret-key',
    });
  }

  async validate(payload: any) {
    // Passport akan otomatis meng-assign return value ini ke object `req.user`
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Token invalid');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role ?? 'USER',
    };
  }
}
