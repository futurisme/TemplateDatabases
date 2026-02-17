import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const rows = await db.$queryRaw<Array<{
    id: string;
    slug: string;
    title: string;
    summary: string;
    type: string;
    tags: string[];
    score: number;
  }>>`
    SELECT
      id,
      slug,
      title,
      summary,
      type,
      tags,
      ts_rank(
        to_tsvector('simple', "searchDocument"),
        websearch_to_tsquery('simple', ${q})
      ) +
      CASE WHEN title ILIKE ${`%${q}%`} THEN 0.35 ELSE 0 END +
      CASE WHEN summary ILIKE ${`%${q}%`} THEN 0.15 ELSE 0 END AS score
    FROM "Template"
    WHERE to_tsvector('simple', "searchDocument") @@ websearch_to_tsquery('simple', ${q})
       OR title ILIKE ${`%${q}%`}
       OR summary ILIKE ${`%${q}%`}
    ORDER BY score DESC, "createdAt" DESC
    LIMIT 20;
  `;

  return NextResponse.json(rows, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
    }
  });
}
