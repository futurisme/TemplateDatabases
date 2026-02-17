import { PrismaClient } from '@prisma/client';
import { AppError, getPrismaAvailabilityIssue } from '@/lib/errors';
import { resolveDatabaseConfig, resolveDatabaseConfigs, type ResolvedDbConfig } from '@/lib/env';

type PrismaRuntimeState = {
  clients: Map<string, PrismaClient>;
  activeUrl: string;
  activeSource: string;
};

declare global {
  // eslint-disable-next-line no-var
  var prismaState: PrismaRuntimeState | undefined;
}

function getState(): PrismaRuntimeState {
  if (!global.prismaState) {
    global.prismaState = {
      clients: new Map<string, PrismaClient>(),
      activeUrl: '',
      activeSource: ''
    };
  }

  return global.prismaState;
}

function createClient(url: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  });
}

function getClientForUrl(url: string): PrismaClient {
  const state = getState();
  const existing = state.clients.get(url);

  if (existing) {
    return existing;
  }

  const client = createClient(url);
  state.clients.set(url, client);
  return client;
}

function shouldRetryWithFallback(error: unknown): boolean {
  return Boolean(getPrismaAvailabilityIssue(error));
}

export function getDb(): PrismaClient {
  const state = getState();
  const config = resolveDatabaseConfig();
  const url = state.activeUrl || config.url;
  return getClientForUrl(url);
}

export async function withDb<T>(operation: (db: PrismaClient, source: string) => Promise<T>): Promise<T> {
  const state = getState();
  const configs = resolveDatabaseConfigs();

  const prioritized: ResolvedDbConfig[] = [];
  if (state.activeUrl) {
    const active = configs.find((item) => item.url === state.activeUrl);
    if (active) prioritized.push(active);
  }

  for (const config of configs) {
    if (!prioritized.some((item) => item.url === config.url)) {
      prioritized.push(config);
    }
  }

  const failures: string[] = [];

  for (const config of prioritized) {
    const client = getClientForUrl(config.url);
    try {
      const result = await operation(client, config.source);
      state.activeUrl = config.url;
      state.activeSource = config.source;
      return result;
    } catch (error) {
      const issue = getPrismaAvailabilityIssue(error);
      const message = issue ? `${config.source}: ${issue}` : `${config.source}: unknown database error`;
      failures.push(message);

      if (!shouldRetryWithFallback(error)) {
        throw error;
      }
    }
  }

  throw new AppError(
    `Database unavailable across configured sources (${failures.join(' | ')}). Validate public/internal connection strings and credentials.`,
    503
  );
}
