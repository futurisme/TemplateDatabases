export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { toErrorPayload } from '@/lib/errors';

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    await getDb().$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        ok: true,
        service: 'templatedatabases',
        database: 'ready',
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
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  }
}
