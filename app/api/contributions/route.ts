import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contributionSchema } from '@/lib/types';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = contributionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { templateId, userId, message } = parsed.data;
  const template = await db.template.findUnique({ where: { id: templateId } });

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  if (template.ownerId === userId) {
    return NextResponse.json({ error: 'Owner cannot contribute to own template' }, { status: 400 });
  }

  const contribution = await db.contribution.create({
    data: { templateId, userId, message }
  });

  return NextResponse.json(contribution, { status: 201 });
}
