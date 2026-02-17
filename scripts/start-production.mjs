import { spawn } from 'node:child_process';

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

async function bootstrapAndStart() {
  const port = process.env.PORT || '8080';

  console.log('[startup] Running prisma generate');
  await runCommand('npx', ['prisma', 'generate']);

  console.log('[startup] Applying migrations (prisma migrate deploy)');
  await runCommand('npx', ['prisma', 'migrate', 'deploy']);

  if (process.env.RUN_DB_SEED === 'true') {
    console.log('[startup] RUN_DB_SEED=true -> running prisma db seed');
    await runCommand('npm', ['run', 'db:seed']);
  }

  console.log(`[startup] Starting Next.js on port ${port}`);
  const app = spawn('npx', ['next', 'start', '-p', port], { stdio: 'inherit', shell: false });

  const shutdown = (signal) => {
    if (!app.killed) {
      app.kill(signal);
    }
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
