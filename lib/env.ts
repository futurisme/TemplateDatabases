import { AppError } from '@/lib/errors';

const requiredEnv = ['DATABASE_URL'] as const;

type ParsedDbUrl = {
  label: string;
  value: string;
  hostname: string;
  username: string;
  password: string;
  database: string;
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

  return {
    label,
    value: trimmed,
    hostname: parsed.hostname.toLowerCase(),
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, '')
  };
}

function getPublicDbCandidates(): ParsedDbUrl[] {
  const pairs: Array<[string, string | undefined]> = [
    ['DATABASE_URL_PUBLIC', process.env.DATABASE_URL_PUBLIC],
    ['DATABASE_PUBLIC_URL', process.env.DATABASE_PUBLIC_URL],
    ['POSTGRES_PRISMA_URL', process.env.POSTGRES_PRISMA_URL],
    ['POSTGRES_URL', process.env.POSTGRES_URL]
  ];

  const seen = new Set<string>();
  const parsed: ParsedDbUrl[] = [];

  for (const [label, value] of pairs) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    parsed.push(parseDbUrl(trimmed, label));
  }

  return parsed;
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

function credentialsMatch(left: ParsedDbUrl, right: ParsedDbUrl): boolean {
  return left.username === right.username && left.password === right.password && left.database === right.database;
}

function selectBestDatabaseUrl(primary: ParsedDbUrl, publicCandidates: ParsedDbUrl[]): string {
  if (!isInternalRailwayHost(primary.hostname)) {
    return ensureSslMode(primary.value);
  }

  const publicOnly = publicCandidates.filter((candidate) => !isInternalRailwayHost(candidate.hostname));

  if (publicOnly.length === 0) {
    throw new AppError(
      'Invalid DB config: DATABASE_URL points to railway.internal but no public DB URL is configured. Set DATABASE_URL_PUBLIC or DATABASE_PUBLIC_URL to Railway public connection string.',
      503
    );
  }

  const credentialMatched = publicOnly.find((candidate) => credentialsMatch(primary, candidate));
  if (credentialMatched) {
    return ensureSslMode(credentialMatched.value);
  }

  const labels = publicOnly.map((candidate) => candidate.label).join(', ');
  throw new AppError(
    `Invalid DB config: none of public DB URLs (${labels}) match DATABASE_URL credentials/database. Ensure username/password/database are identical between internal and public Railway URLs.`,
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
