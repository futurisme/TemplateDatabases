import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from '@/lib/env';

type PrismaRuntimeState = {
  client: PrismaClient;
  url: string;
};

declare global {
  // eslint-disable-next-line no-var
  var prismaState: PrismaRuntimeState | undefined;
}

function createClient(url: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  });
}

export function getDb(): PrismaClient {
  const dbUrl = resolveDatabaseUrl();
  const existing = global.prismaState;

  if (existing && existing.url === dbUrl) {
    return existing.client;
  }

  const client = createClient(dbUrl);
  global.prismaState = { client, url: dbUrl };

  return client;
}
