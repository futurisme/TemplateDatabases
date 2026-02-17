import { AppError } from '@/lib/errors';

const requiredEnv = ['DATABASE_URL'] as const;

type ParsedDbUrl = {
  label: string;
  raw: string;
  hostname: string;
};

type ResolvedDbConfig = {
  url: string;
  source: string;
  hostname: string;
};

function parseDbUrl(rawValue: string, label: string): ParsedDbUrl {
  const raw = rawValue.trim();
  if (raw.length === 0) {
    throw new AppError(`${label} is empty`, 503);
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new AppError(`${label} is invalid`, 503);
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new AppError(`${label} must use postgres/postgresql protocol`, 503);
  }

  if (!parsed.username || !parsed.password || parsed.pathname.replace(/^\//, '').length === 0) {
    throw new AppError(`${label} must include username, password, and database name`, 503);
  }

  return { label, raw, hostname: parsed.hostname.toLowerCase() };
}

function isInternalRailwayHost(hostname: string): boolean {
  return hostname.endsWith('.railway.internal');
}

function withRequiredSsl(url: string): string {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const shouldRequireSsl = host.endsWith('.proxy.rlwy.net') || host.endsWith('.up.railway.app');

  if (shouldRequireSsl && !parsed.searchParams.has('sslmode')) {
    parsed.searchParams.set('sslmode', 'require');
    return parsed.toString();
  }

  return url;
}

function getExplicitPublicCandidate(): ParsedDbUrl | null {
  const explicit = [
    ['DATABASE_URL_PUBLIC', process.env.DATABASE_URL_PUBLIC],
    ['DATABASE_PUBLIC_URL', process.env.DATABASE_PUBLIC_URL]
  ] as const;

  for (const [label, value] of explicit) {
    if (value && value.trim().length > 0) {
      return parseDbUrl(value, label);
    }
  }

  return null;
}

function resolveFromPrimary(primary: ParsedDbUrl): ResolvedDbConfig {
  if (!isInternalRailwayHost(primary.hostname)) {
    return {
      url: withRequiredSsl(primary.raw),
      source: primary.label,
      hostname: primary.hostname
    };
  }

  const publicCandidate = getExplicitPublicCandidate();
  if (!publicCandidate) {
    throw new AppError(
      'DATABASE_URL is internal-only (.railway.internal). Set DATABASE_PUBLIC_URL (or DATABASE_URL_PUBLIC) to a public Railway URL for runtime requests.',
      503
    );
  }

  if (isInternalRailwayHost(publicCandidate.hostname)) {
    throw new AppError('DATABASE_PUBLIC_URL/DATABASE_URL_PUBLIC cannot use .railway.internal host', 503);
  }

  return {
    url: withRequiredSsl(publicCandidate.raw),
    source: publicCandidate.label,
    hostname: publicCandidate.hostname
  };
}

let cached: ResolvedDbConfig | null = null;

export function resolveDatabaseConfig(): ResolvedDbConfig {
  if (cached) {
    return cached;
  }

  for (const key of requiredEnv) {
    if (!process.env[key] || process.env[key]?.trim().length === 0) {
      throw new AppError(`Missing required environment variable: ${key}`, 503);
    }
  }

  const primary = parseDbUrl(process.env.DATABASE_URL!, 'DATABASE_URL');
  cached = resolveFromPrimary(primary);

  return cached;
}

export function resolveDatabaseUrl(): string {
  return resolveDatabaseConfig().url;
}
