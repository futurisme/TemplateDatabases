import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const BIN = join(process.cwd(), 'node_modules', '.bin');
const PRISMA_BIN = join(BIN, 'prisma');
const NEXT_BIN = join(BIN, 'next');
const TSX_BIN = join(BIN, 'tsx');

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false, ...options });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} terminated by signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
        return;
      }
      resolve();
    });
  });
}

function hasMigrations() {
  const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
  if (!existsSync(migrationsDir)) return false;
  const entries = readdirSync(migrationsDir, { withFileTypes: true });
  return entries.some((entry) => entry.isDirectory() && /^\d+_.+/.test(entry.name));
}

function ensureBinaries() {
  if (!existsSync(PRISMA_BIN) || !existsSync(NEXT_BIN)) {
    throw new Error('Required runtime binaries are missing. Ensure dependencies are installed without pruning required packages.');
  }
}

async function applyDatabaseSchema() {
  if (hasMigrations()) {
    console.log('[startup] Applying migrations (prisma migrate deploy)');
    await runCommand(PRISMA_BIN, ['migrate', 'deploy']);
    return;
  }

  console.log('[startup] No migration directory found. Applying schema with prisma db push (non-destructive)');
  await runCommand(PRISMA_BIN, ['db', 'push', '--skip-generate']);
}

async function maybeSeed() {
  if (process.env.RUN_DB_SEED !== 'true') {
    return;
  }

  if (!existsSync(TSX_BIN)) {
    throw new Error('RUN_DB_SEED=true but tsx binary is missing. Install dependencies with tsx available.');
  }

  console.log('[startup] RUN_DB_SEED=true -> running prisma/seed.ts');
  await runCommand(TSX_BIN, ['prisma/seed.ts']);
}

async function bootstrapAndStart() {
  ensureBinaries();

  const port = process.env.PORT || '8080';

  console.log('[startup] Running prisma generate');
  await runCommand(PRISMA_BIN, ['generate']);

  await applyDatabaseSchema();
  await maybeSeed();

  console.log(`[startup] Starting Next.js on port ${port}`);
  const app = spawn(NEXT_BIN, ['start', '-p', port], { stdio: 'inherit', shell: false });

  const shutdown = (signal) => {
    if (!app.killed) app.kill(signal);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  app.on('exit', (code, signal) => {
    if (signal) {
      process.exit(0);
      return;
    }
    process.exit(code ?? 0);
  });
}

bootstrapAndStart().catch((error) => {
  console.error('[startup] Fatal bootstrap error:', error);
  process.exit(1);
});
