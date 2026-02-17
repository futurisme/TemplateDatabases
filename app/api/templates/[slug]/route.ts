export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { AppError, toErrorPayload } from '@/lib/errors';

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    if (!params.slug || params.slug.trim().length < 2) {
      throw new AppError('Invalid template slug', 400);
    }

    const template = await getDb().template.findUnique({
      where: { slug: params.slug },
      include: { owner: { select: { displayName: true, username: true, id: true } } }
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    return NextResponse.json(template, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' }
    });
  } catch (error) {
    const payload = toErrorPayload(error);
    console.error(`GET /api/templates/${params.slug} failed:`, error);
    return NextResponse.json({ error: payload.message }, { status: payload.status });
  }
}
