export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withDb } from '@/lib/db';
import { AppError, toErrorPayload } from '@/lib/errors';
import { compactText, slugify } from '@/lib/utils';

type ForkPayload = {
  ownerRef?: string;
};

async function resolveOwnerId(ownerRef: string): Promise<string> {
  return withDb(async (db) => {
    const trimmed = ownerRef.trim();

    const byId = await db.user.findUnique({ where: { id: trimmed }, select: { id: true } });
    if (byId) return byId.id;

    const byUsername = await db.user.findUnique({ where: { username: trimmed }, select: { id: true } });
    if (byUsername) return byUsername.id;

    const username = slugify(trimmed).replace(/-/g, '').slice(0, 24) || `user${Date.now()}`;
    const displayName = trimmed.slice(0, 60);

    const created = await db.user.upsert({
      where: { username },
      update: { displayName },
      create: { username, displayName }
    });

    return created.id;
  });
}

async function createForkWithUniqueSlug(payload: {
  title: string;
  summary: string;
  content: string;
  type: 'CODE' | 'IDEA' | 'STORY' | 'OTHER';
  tags: string[];
  ownerId: string;
}) {
  const base = slugify(payload.title);
  for (let i = 0; i < 6; i += 1) {
    const suffix = i === 0 ? 'fork' : `fork-${crypto.randomUUID().slice(0, 6)}`;
    const slug = `${base}-${suffix}`;

    try {
      return await withDb((db) =>
        db.template.create({
          data: {
            ...payload,
            slug,
            featured: false,
            searchDocument: compactText(payload.title, payload.summary, payload.content, payload.tags.join(' '))
          }
        })
      );
    } catch (error) {
      const isConflict = String(error).includes('Unique constraint') || String(error).includes('P2002');
      if (!isConflict) throw error;
    }
  }

  throw new AppError('Failed to create unique fork slug', 409);
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const body = (await req.json().catch(() => ({}))) as ForkPayload;
    const ownerRef = String(body.ownerRef ?? '').trim();
    if (ownerRef.length < 2) {
      throw new AppError('ownerRef is required', 400);
    }

    const source = await withDb((db) =>
      db.template.findUnique({
        where: { slug: params.slug },
        select: { title: true, summary: true, content: true, type: true, tags: true }
      })
    );

    if (!source) {
      throw new AppError('Template not found', 404);
    }

    const ownerId = await resolveOwnerId(ownerRef);
    const forked = await createForkWithUniqueSlug({
      title: `${source.title} Fork`,
      summary: source.summary,
      content: source.content,
      type: source.type,
      tags: source.tags,
      ownerId
    });

    return NextResponse.json({ id: forked.id, slug: forked.slug }, { status: 201 });
  } catch (error) {
    const payload = toErrorPayload(error);
    console.error(`POST /api/templates/${params.slug}/fork failed:`, error);
    return NextResponse.json({ error: payload.message }, { status: payload.status });
  }
}
