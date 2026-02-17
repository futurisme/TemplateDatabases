export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getDb } from '@/lib/db';
import { createTemplateSchema } from '@/lib/types';
import { compactText, slugify } from '@/lib/utils';
import { AppError, getPrismaAvailabilityIssue, toErrorPayload } from '@/lib/errors';
import { featuredFallback } from '@/lib/featured-fallback';

export const revalidate = 0;

async function createWithUniqueSlug(payload: {
  title: string;
  summary: string;
  content: string;
  type: 'CODE' | 'IDEA' | 'STORY' | 'OTHER';
  tags: string[];
  ownerId: string;
  featured?: boolean;
}) {
  const base = slugify(payload.title);
  for (let i = 0; i < 5; i += 1) {
    const slug = i === 0 ? base : `${base}-${crypto.randomUUID().slice(0, 6)}`;
    try {
      return await getDb().template.create({
        data: {
          ...payload,
          slug,
          searchDocument: compactText(payload.title, payload.summary, payload.content, payload.tags.join(' '))
        }
      });
    } catch (error) {
      const isConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        String(error.meta?.target).includes('slug');

      if (!isConflict) {
        throw error;
      }
    }
  }

  throw new AppError('Failed to generate unique slug after multiple attempts', 409);
}

export async function GET(req: NextRequest) {
  const featuredOnly = req.nextUrl.searchParams.get('featured') === '1';

  try {
    const data = await getDb().template.findMany({
      where: featuredOnly ? { featured: true } : undefined,
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      take: featuredOnly ? 8 : 50,
      include: { owner: { select: { id: true, username: true, displayName: true } } }
    });

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': featuredOnly
          ? 'public, s-maxage=120, stale-while-revalidate=300'
          : 'no-store'
      }
    });
  } catch (error) {
    console.error('GET /api/templates failed:', error);

    const issue = getPrismaAvailabilityIssue(error);
    if (featuredOnly && issue) {
      return NextResponse.json(featuredFallback, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          'X-TemplateData-Source': 'fallback'
        }
      });
    }

    const payload = toErrorPayload(error);
    return NextResponse.json({ error: payload.message }, { status: payload.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createTemplateSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError('Invalid request payload', 400);
    }

    const owner = await getDb().user.findUnique({ where: { id: parsed.data.ownerId }, select: { id: true } });
    if (!owner) {
      throw new AppError('Owner not found', 404);
    }

    const created = await createWithUniqueSlug(parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const payload = toErrorPayload(error);
    console.error('POST /api/templates failed:', error);
    return NextResponse.json({ error: payload.message }, { status: payload.status });
  }
}
