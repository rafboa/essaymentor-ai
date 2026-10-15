import type { Role } from '@prisma/client';

/** What JwtStrategy puts on `req.user`, read fresh from the database. */
export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
}

export interface JwtPayload {
  sub?: string;
  email?: string;
}
