export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getDb } from '@/lib/db';
import { compactText, slugify } from '@/lib/utils';
import { AppError, getPrismaAvailabilityIssue, toErrorPayload } from '@/lib/errors';
import { featuredFallback } from '@/lib/featured-fallback';

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

  const title = String(raw.title ?? '').trim();
  const summary = String(raw.summary ?? '').trim();
  const content = String(raw.content ?? '').trim();
  const typeRaw = String(raw.type ?? 'OTHER').trim().toUpperCase();
  const ownerRef = String(raw.ownerRef ?? raw.ownerId ?? '').trim();
  const featured = raw.featured === true;

  const tagsInput = raw.tags;
  const tags = Array.isArray(tagsInput)
    ? tagsInput.map((v) => String(v).trim()).filter(Boolean)
    : String(tagsInput ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

  const allowedTypes: CreateTemplateInput['type'][] = ['CODE', 'IDEA', 'STORY', 'OTHER'];

  const errors: string[] = [];
  if (title.length < 3 || title.length > 120) errors.push('title must be between 3 and 120 characters');
  if (summary.length < 10 || summary.length > 300) errors.push('summary must be between 10 and 300 characters');
  if (content.length < 10) errors.push('content must be at least 10 characters');
  if (!allowedTypes.includes(typeRaw as CreateTemplateInput['type'])) errors.push('type must be CODE|IDEA|STORY|OTHER');
  if (ownerRef.length < 2 || ownerRef.length > 64) errors.push('ownerRef (or ownerId) must be between 2 and 64 characters');
  if (tags.length > 12) errors.push('tags cannot exceed 12 items');
  if (tags.some((t) => t.length < 1 || t.length > 30)) errors.push('each tag length must be between 1 and 30 characters');

  if (errors.length > 0) {
    throw new AppError(`Invalid request payload: ${errors.join('; ')}`, 400);
  }

  return {
    title,
    summary,
    content,
    type: typeRaw as CreateTemplateInput['type'],
    tags,
    ownerRef,
    featured
  };
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
