import { PrismaClient, Plan, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Seeds one demo student and one admin account. Idempotent: re-running
 * resets each account's name, role and password to the values below.
 * Run with `npx prisma db seed` (Prisma loads .env).
 */
const prisma = new PrismaClient();

interface SeedAccount {
  email: string;
  fullName: string;
  role: Role;
  plan: Plan;
  passwordEnv: string;
}

const accounts: SeedAccount[] = [
  {
    email: process.env.SEED_USER_EMAIL ?? 'demo@essaymentor.test',
    fullName: 'Demo Pelamar',
    role: Role.USER,
    plan: Plan.FREE,
    passwordEnv: 'SEED_USER_PASSWORD',
  },
  {
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@essaymentor.test',
    fullName: 'Admin EssayMentor',
    role: Role.ADMIN,
    plan: Plan.PRO,
    passwordEnv: 'SEED_ADMIN_PASSWORD',
  },
];

async function main() {
  for (const account of accounts) {
    const password = process.env[account.passwordEnv];
    if (!password || password.length < 8) {
      throw new Error(
        `${account.passwordEnv} must be set (min 8 characters) in .env`,
      );
    }
    const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    await prisma.user.upsert({
      where: { email: account.email },
      create: {
        email: account.email,
        fullName: account.fullName,
        role: account.role,
        plan: account.plan,
        passwordHash,
      },
      update: {
        fullName: account.fullName,
        role: account.role,
        plan: account.plan,
        passwordHash,
      },
    });
    console.log(`Seeded ${account.role.toLowerCase()}: ${account.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
