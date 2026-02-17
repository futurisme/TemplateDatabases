export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withDb } from '@/lib/db';
import { AppError, toErrorPayload } from '@/lib/errors';

function sanitizeQuery(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

export async function GET(req: NextRequest) {
  try {
    const q = sanitizeQuery(req.nextUrl.searchParams.get('q') ?? '');

    if (q.length < 2) {
      return NextResponse.json([], {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
        }
      });
    }

    if (q.length > 120) {
      throw new AppError('Kueri pencarian terlalu panjang (maksimal 120 karakter).', 400);
    }

    const lowerQ = q.toLowerCase();

    const rows = await withDb((db) => {
      if (q.length <= 3) {
        return db.$queryRaw`
          SELECT id, slug, title, summary, type, tags
          FROM "Template"
          WHERE lower(title) LIKE ${`${lowerQ}%`}
             OR EXISTS (
                SELECT 1
                FROM unnest(tags) AS tag
                WHERE lower(tag) LIKE ${`${lowerQ}%`}
             )
             OR lower(summary) LIKE ${`${lowerQ}%`}
          ORDER BY
            CASE WHEN lower(title) = ${lowerQ} THEN 0 ELSE 1 END,
            CASE WHEN lower(title) LIKE ${`${lowerQ}%`} THEN 0 ELSE 1 END,
            "createdAt" DESC
          LIMIT 20;
        `;
      }

      return db.$queryRaw`
        WITH ranked AS (
          SELECT
            id,
            slug,
            title,
            summary,
            type,
            tags,
            ts_rank_cd(
              to_tsvector('simple', "searchDocument"),
              websearch_to_tsquery('simple', ${q})
            )
            + similarity(title, ${q}) * 0.8
            + similarity(summary, ${q}) * 0.35 AS score,
            "createdAt"
          FROM "Template"
          WHERE to_tsvector('simple', "searchDocument") @@ websearch_to_tsquery('simple', ${q})
             OR title % ${q}
             OR summary % ${q}
        )
        SELECT id, slug, title, summary, type, tags
        FROM ranked
        ORDER BY score DESC, "createdAt" DESC
        LIMIT 20;
      `;
    });

    return NextResponse.json(rows, {
      headers: {
        'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=600'
      }
    });
  } catch (error) {
    const payload = toErrorPayload(error);
    console.error('GET /api/search failed:', error);
    return NextResponse.json({ error: payload.message }, { status: payload.status });
  }
}
