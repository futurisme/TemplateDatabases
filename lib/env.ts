import { AppError } from '@/lib/errors';

const requiredEnv = ['DATABASE_URL'] as const;

function getHostFromUrl(url: string, label: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    throw new AppError(`${label} is invalid`, 503);
  }
}

function getPublicDbCandidate(): string | undefined {
  const candidates = [
    process.env.DATABASE_URL_PUBLIC,
    process.env.DATABASE_PUBLIC_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL
  ]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));

  return candidates[0];
}

export function resolveDatabaseUrl(): string {
  for (const key of requiredEnv) {
    if (!process.env[key] || process.env[key]?.trim().length === 0) {
      throw new AppError(`Missing required environment variable: ${key}`, 503);
    }
  }

  const primary = process.env.DATABASE_URL!.trim();
  const publicCandidate = getPublicDbCandidate();
  const isVercelRuntime = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const primaryHost = getHostFromUrl(primary, 'DATABASE_URL');

  if (isVercelRuntime && primaryHost.endsWith('.railway.internal')) {
    if (!publicCandidate) {
      throw new AppError(
        'Invalid DB config for Vercel: DATABASE_URL is railway.internal but no public DB URL env is set (DATABASE_URL_PUBLIC / DATABASE_PUBLIC_URL / POSTGRES_PRISMA_URL / POSTGRES_URL).',
        503
      );
    }

    getHostFromUrl(publicCandidate, 'public database URL');
    return publicCandidate;
  }

  return primary;
}
