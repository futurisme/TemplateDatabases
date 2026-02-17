import { AppError } from '@/lib/errors';

const requiredEnv = ['DATABASE_URL'] as const;

function getHostFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    throw new AppError('DATABASE_URL is invalid', 500);
  }
}

export function resolveDatabaseUrl(): string {
  for (const key of requiredEnv) {
    if (!process.env[key] || process.env[key]?.trim().length === 0) {
      throw new AppError(`Missing required environment variable: ${key}`, 500);
    }
  }

  const primary = process.env.DATABASE_URL!.trim();
  const publicCandidate = process.env.DATABASE_URL_PUBLIC?.trim();
  const isVercelRuntime = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const primaryHost = getHostFromUrl(primary);

  if (isVercelRuntime && primaryHost.endsWith('.railway.internal')) {
    if (!publicCandidate) {
      throw new AppError(
        'Invalid DB config: DATABASE_URL points to railway.internal on Vercel. Set DATABASE_URL_PUBLIC with Railway public URL.',
        500
      );
    }
    return publicCandidate;
  }

  return primary;
}
