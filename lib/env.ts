import { AppError } from '@/lib/errors';

const requiredEnv = ['DATABASE_URL'] as const;

type ParsedDbUrl = {
  value: string;
  hostname: string;
};

function parseDbUrl(value: string, label: string): ParsedDbUrl {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new AppError(`${label} is empty`, 503);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError(`${label} is invalid`, 503);
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new AppError(`${label} must use postgres/postgresql protocol`, 503);
  }

  return { value: trimmed, hostname: parsed.hostname.toLowerCase() };
}

function getPublicDbCandidates(): string[] {
  return [
    process.env.DATABASE_URL_PUBLIC,
    process.env.DATABASE_PUBLIC_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function isInternalRailwayHost(hostname: string): boolean {
  return hostname.endsWith('.railway.internal');
}

function ensureSslMode(url: string): string {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const mustUseSsl = host.endsWith('.proxy.rlwy.net') || host.endsWith('.up.railway.app');

  if (mustUseSsl && !parsed.searchParams.has('sslmode')) {
    parsed.searchParams.set('sslmode', 'require');
    return parsed.toString();
  }

  return url;
}

function selectBestDatabaseUrl(primary: ParsedDbUrl, publicCandidates: string[]): string {
  const primaryIsInternal = isInternalRailwayHost(primary.hostname);

  if (!primaryIsInternal) {
    return ensureSslMode(primary.value);
  }

  for (const candidate of publicCandidates) {
    const parsedCandidate = parseDbUrl(candidate, 'public database URL');
    if (!isInternalRailwayHost(parsedCandidate.hostname)) {
      return ensureSslMode(parsedCandidate.value);
    }
  }

  throw new AppError(
    'Invalid DB config: DATABASE_URL points to railway.internal but no public DB URL is configured. Set DATABASE_URL_PUBLIC or DATABASE_PUBLIC_URL to Railway public connection string.',
    503
  );
}

export function resolveDatabaseUrl(): string {
  for (const key of requiredEnv) {
    if (!process.env[key] || process.env[key]?.trim().length === 0) {
      throw new AppError(`Missing required environment variable: ${key}`, 503);
    }
  }

  const primary = parseDbUrl(process.env.DATABASE_URL!, 'DATABASE_URL');
  const publicCandidates = getPublicDbCandidates();

  return selectBestDatabaseUrl(primary, publicCandidates);
}
