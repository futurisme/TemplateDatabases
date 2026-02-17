export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { AppError, getPrismaAvailabilityIssue, toErrorPayload } from '@/lib/errors';
import { featuredFallback } from '@/lib/featured-fallback';

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
    console.error(`GET /api/templates/${params.slug} failed:`, error);

    const issue = getPrismaAvailabilityIssue(error);
    if (issue) {
      const fallback = featuredFallback.find((item) => item.slug === params.slug);
      if (fallback) {
        return NextResponse.json(
          {
            ...fallback,
            ownerId: fallback.owner.id,
            content: `${fallback.title}\n\n${fallback.summary}\n\nStatus: Fallback mode aktif karena database belum tersedia.`
          },
          {
            status: 200,
            headers: {
              'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
              'X-TemplateData-Source': 'fallback'
            }
          }
        );
      }
    }

    const payload = toErrorPayload(error);
    return NextResponse.json({ error: payload.message }, { status: payload.status });
  }
}
