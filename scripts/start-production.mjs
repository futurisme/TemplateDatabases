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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

async function bootstrapDatabase() {
  await applyDatabaseSchema();
  await maybeSeed();
}

async function bootstrapDatabaseWithRetries() {
  const maxAttempts = parsePositiveInt(process.env.DB_BOOTSTRAP_MAX_ATTEMPTS, 30);
  const backoffMs = parsePositiveInt(process.env.DB_BOOTSTRAP_RETRY_MS, 5000);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await bootstrapDatabase();
      console.log(`[startup] Database bootstrap completed on attempt ${attempt}/${maxAttempts}`);
      return;
    } catch (error) {
      const printable = error instanceof Error ? error.message : String(error);
      const isLast = attempt >= maxAttempts;

      if (isLast) {
        console.error(`[startup] Database bootstrap failed after ${maxAttempts} attempts: ${printable}`);
        throw error;
      }

      console.warn(`[startup] Database bootstrap attempt ${attempt}/${maxAttempts} failed: ${printable}`);
      console.warn(`[startup] Retrying database bootstrap in ${backoffMs}ms`);
      await sleep(backoffMs);
    }
  }
}

function startNextApp(port) {
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

  return app;
}

async function bootstrapAndStart() {
  ensureBinaries();

  const port = process.env.PORT || '8080';
  const strictBootstrap = process.env.DB_BOOTSTRAP_STRICT === 'true';

  console.log('[startup] Running prisma generate');
  await runCommand(PRISMA_BIN, ['generate']);

  if (strictBootstrap) {
    console.log('[startup] DB_BOOTSTRAP_STRICT=true -> blocking startup until database bootstrap succeeds');
    await bootstrapDatabaseWithRetries();
    startNextApp(port);
    return;
  }

  startNextApp(port);

  bootstrapDatabaseWithRetries().catch((error) => {
    console.error('[startup] Database bootstrap exhausted retries (app kept running):', error);
  });
}

bootstrapAndStart().catch((error) => {
  console.error('[startup] Fatal bootstrap error:', error);
  process.exit(1);
});
