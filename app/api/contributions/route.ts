export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withDb } from '@/lib/db';
import { contributionSchema } from '@/lib/types';
import { AppError, toErrorPayload } from '@/lib/errors';
import { slugify } from '@/lib/utils';

type LegacyPayload = {
  templateId?: string;
  templateSlug?: string;
  userId?: string;
  ownerRef?: string;
  contributorRef?: string;
  message?: string;
};

function normalizeContributionPayload(body: unknown) {
  if (!body || typeof body !== 'object') {
    throw new AppError('Invalid request payload', 400);
  }

  const raw = body as LegacyPayload & Record<string, unknown>;
  const templateRef = String(raw.templateRef ?? raw.templateSlug ?? raw.templateId ?? '').trim();
  const contributorRef = String(raw.contributorRef ?? raw.ownerRef ?? raw.userId ?? '').trim();
  const message = String(raw.message ?? '').trim();

  const parsed = contributionSchema.safeParse({ templateRef, contributorRef, message });
  if (!parsed.success) {
    throw new AppError('Invalid request payload', 400);
  }

  return parsed.data;
}

async function resolveContributorId(contributorRef: string): Promise<string> {
  return withDb(async (db) => {
    const trimmed = contributorRef.trim();

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { templateRef, contributorRef, message } = normalizeContributionPayload(body);

    const userId = await resolveContributorId(contributorRef);

    const template = await withDb((db) =>
      db.template.findFirst({
        where: {
          OR: [{ id: templateRef }, { slug: templateRef }]
        },
        select: { id: true, ownerId: true }
      })
    );

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    if (template.ownerId === userId) {
      throw new AppError('Owner cannot contribute to own template', 400);
    }

    const contribution = await withDb((db) =>
      db.contribution.create({
        data: { templateId: template.id, userId, message }
      })
    );

    return NextResponse.json(contribution, { status: 201 });
  } catch (error) {
    const payload = toErrorPayload(error);
    console.error('POST /api/contributions failed:', error);
    return NextResponse.json({ error: payload.message }, { status: payload.status });
  }
}
