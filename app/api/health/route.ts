export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'templatedatabases',
      timestamp: new Date().toISOString()
    },
    {
      headers: { 'Cache-Control': 'no-store' }
    }
  );
}
