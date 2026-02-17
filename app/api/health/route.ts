export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withDb } from '@/lib/db';
import { toErrorPayload } from '@/lib/errors';
import { getSafeDatabaseRuntimeMeta, resolveDatabaseConfigs } from '@/lib/env';

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const meta = getSafeDatabaseRuntimeMeta();
    const activeSource = await withDb(async (db, source) => {
      await db.$queryRaw`SELECT 1`;
      return source;
    });

    const activeConfig = resolveDatabaseConfigs().find((config) => config.source === activeSource);

    return NextResponse.json(
      {
        ok: true,
        service: 'templatedatabases',
        database: 'ready',
        dbHost: activeConfig?.hostname ?? meta.hostname,
        dbSource: activeSource,
        runtime: meta.runtime,
        timestamp
      },
      {
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  } catch (error) {
    const payload = toErrorPayload(error);
    console.error('GET /api/health failed:', error);

    return NextResponse.json(
      {
        ok: false,
        service: 'templatedatabases',
        database: 'unavailable',
        error: payload.message,
        timestamp
      },
      {
        status: payload.status,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': payload.status === 503 ? '30' : '0' }
      }
    );
  }
}
