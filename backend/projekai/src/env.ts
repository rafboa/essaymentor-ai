// Loads .env before any module reads process.env. Imported first in main.ts.
// Hosts that inject env vars directly (Railway, Docker) have no .env; that is fine.
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}
