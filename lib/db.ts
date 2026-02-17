import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from '@/lib/env';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export function getDb(): PrismaClient {
  const dbUrl = resolveDatabaseUrl();

  const client =
    global.prisma ??
    new PrismaClient({
      datasources: { db: { url: dbUrl } },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
    });

  if (process.env.NODE_ENV !== 'production') {
    global.prisma = client;
  }

  return client;
}
