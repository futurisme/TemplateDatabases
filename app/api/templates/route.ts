import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createTemplateSchema } from '@/lib/types';
import { compactText, slugify } from '@/lib/utils';
import { fallbackTemplates } from '@/lib/fallback';

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const featuredOnly = req.nextUrl.searchParams.get('featured') === '1';
  const data = await db.template
    .findMany({
      where: featuredOnly ? { featured: true } : undefined,
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      take: featuredOnly ? 8 : 50,
      include: { owner: { select: { id: true, username: true, displayName: true } } }
    })
    .catch(() => fallbackTemplates);
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': featuredOnly
        ? 'public, s-maxage=120, stale-while-revalidate=300'
        : 'no-store'
    }
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const slugBase = slugify(payload.title);
  const similarCount = await db.template.count({ where: { slug: { startsWith: slugBase } } });
  const slug = similarCount === 0 ? slugBase : `${slugBase}-${similarCount + 1}`;

  const created = await db.template.create({
    data: {
      ...payload,
      slug,
      searchDocument: compactText(payload.title, payload.summary, payload.content, payload.tags.join(' '))
    }
  });

  return NextResponse.json(created, { status: 201 });
}
