export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getDb } from '@/lib/db';
import { compactText, slugify } from '@/lib/utils';
import { AppError, getPrismaAvailabilityIssue, toErrorPayload } from '@/lib/errors';
import { featuredFallback } from '@/lib/featured-fallback';
import { createTemplateSchema } from '@/lib/types';

export const revalidate = 0;

type CreateTemplateInput = {
  title: string;
  summary: string;
  content: string;
  type: 'CODE' | 'IDEA' | 'STORY' | 'OTHER';
  tags: string[];
  ownerRef: string;
  featured?: boolean;
};

function normalizeCreateTemplatePayload(body: unknown): CreateTemplateInput {
  if (!body || typeof body !== 'object') {
    throw new AppError('Invalid request payload: body must be an object', 400);
  }

  const raw = body as Record<string, unknown>;
  const rawTags = raw.tags;

  const tags = Array.isArray(rawTags)
    ? rawTags.map((value) => String(value).trim()).filter(Boolean)
    : String(rawTags ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

  const normalized = {
    title: String(raw.title ?? '').trim(),
    summary: String(raw.summary ?? '').trim(),
    content: String(raw.content ?? '').trim(),
    type: String(raw.type ?? 'OTHER').trim().toUpperCase(),
    tags,
    ownerRef: String(raw.ownerRef ?? raw.ownerId ?? '').trim(),
    featured: raw.featured === true
  };

  const parsed = createTemplateSchema.safeParse(normalized);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'payload'}: ${issue.message}`)
      .join('; ');
    throw new AppError(`Invalid request payload: ${message}`, 400);
  }

  return parsed.data;
}

async function resolveOwnerId(ownerRef: string): Promise<string> {
  const db = getDb();
  const trimmed = ownerRef.trim();

  const byId = await db.user.findUnique({ where: { id: trimmed }, select: { id: true } });
  if (byId) return byId.id;

  const byUsername = await db.user.findUnique({ where: { username: trimmed }, select: { id: true } });
  if (byUsername) return byUsername.id;

  const normalizedUsername = slugify(trimmed).replace(/-/g, '').slice(0, 24) || `user${Date.now()}`;
  const displayName = trimmed.slice(0, 60);

  const created = await db.user.upsert({
    where: { username: normalizedUsername },
    update: { displayName },
    create: { username: normalizedUsername, displayName }
  });

  return created.id;
}

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
    const parsed = normalizeCreateTemplatePayload(body);

    const ownerId = await resolveOwnerId(parsed.ownerRef);

    const created = await createWithUniqueSlug({
      title: parsed.title,
      summary: parsed.summary,
      content: parsed.content,
      type: parsed.type,
      tags: parsed.tags,
      featured: parsed.featured,
      ownerId
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const payload = toErrorPayload(error);
    console.error('POST /api/templates failed:', error);
    return NextResponse.json({ error: payload.message }, { status: payload.status });
  }
}
