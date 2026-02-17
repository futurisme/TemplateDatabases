import { PrismaClient } from '@prisma/client';
import { assertServerEnv } from '@/lib/env';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export function getDb(): PrismaClient {
  assertServerEnv();

  const client =
    global.prisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
    });

  if (process.env.NODE_ENV !== 'production') {
    global.prisma = client;
  }

  return client;
}
