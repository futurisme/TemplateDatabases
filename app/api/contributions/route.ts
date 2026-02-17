export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { contributionSchema } from '@/lib/types';
import { AppError, toErrorPayload } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = contributionSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError('Invalid request payload', 400);
    }

    const { templateId, userId, message } = parsed.data;

    const [template, user] = await Promise.all([
      getDb().template.findUnique({ where: { id: templateId } }),
      getDb().user.findUnique({ where: { id: userId } })
    ]);

    if (!template) {
      throw new AppError('Template not found', 404);
    }
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (template.ownerId === userId) {
      throw new AppError('Owner cannot contribute to own template', 400);
    }

    const contribution = await getDb().contribution.create({
      data: { templateId, userId, message }
    });

    return NextResponse.json(contribution, { status: 201 });
  } catch (error) {
    const payload = toErrorPayload(error);
    console.error('POST /api/contributions failed:', error);
    return NextResponse.json({ error: payload.message }, { status: payload.status });
  }
}
