// E2E suites boot the real AppModule, which needs .env (DATABASE_URL) and a
// JWT secret. The fallback secret exists only in tests; the app has none.
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}
process.env.JWT_SECRET ??= 'e2e-test-secret-'.padEnd(48, 'x');
