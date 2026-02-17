import { AppError } from '@/lib/errors';

const requiredEnv = ['DATABASE_URL'] as const;

function getHostFromUrl(url: string, label: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    throw new AppError(`${label} is invalid`, 503);
  }
}

export function resolveDatabaseUrl(): string {
  for (const key of requiredEnv) {
    if (!process.env[key] || process.env[key]?.trim().length === 0) {
      throw new AppError(`Missing required environment variable: ${key}`, 503);
    }
  }

  const primary = process.env.DATABASE_URL!.trim();
  const publicCandidate = process.env.DATABASE_URL_PUBLIC?.trim();
  const isVercelRuntime = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const primaryHost = getHostFromUrl(primary, 'DATABASE_URL');

  if (isVercelRuntime && primaryHost.endsWith('.railway.internal')) {
    if (!publicCandidate) {
      throw new AppError(
        'Invalid DB config for Vercel: DATABASE_URL is railway.internal but DATABASE_URL_PUBLIC is missing.',
        503
      );
    }

    getHostFromUrl(publicCandidate, 'DATABASE_URL_PUBLIC');
    return publicCandidate;
  }

  return primary;
}
