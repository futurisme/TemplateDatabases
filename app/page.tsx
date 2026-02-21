import Link from 'next/link';
import { SearchBox } from '@/components/SearchBox';
import { FeaturedTemplates, type FeaturedItem } from '@/components/FeaturedTemplates';
import { withDb } from '@/lib/db';
import { getPrismaAvailabilityIssue } from '@/lib/errors';
import { featuredFallback } from '@/lib/featured-fallback';

export const dynamic = 'force-dynamic';

async function getFeaturedTemplates(): Promise<{ items: FeaturedItem[]; error?: string }> {
  try {
    const items = await withDb(async (db) => {
      const featured = await db.template.findMany({
        where: { featured: true },
        orderBy: [{ createdAt: 'desc' }],
        take: 8,
        include: { owner: { select: { displayName: true } } }
      });

      if (featured.length > 0) {
        return featured;
      }

      return db.template.findMany({
        orderBy: [{ createdAt: 'desc' }],
        take: 8,
        include: { owner: { select: { displayName: true } } }
      });
    });

    return { items };
  } catch (error) {
    console.error('Failed to load featured templates on server:', error);
    if (getPrismaAvailabilityIssue(error)) {
      return { items: featuredFallback };
    }

    return { items: featuredFallback, error: 'Featured fallback mode aktif.' };
  }
}

export default async function HomePage() {
  const { items, error } = await getFeaturedTemplates();

  return (
    <main className="page-shell">
      <SearchBox />

      <section className="hero card compact">
        <p className="badge">TemplateDatabase</p>
        <h1>Temukan template terbaik secepat mesin pencari modern.</h1>
        <p className="muted hero-copy">Cari cepat, lihat featured, lalu kontribusi.</p>
        <div className="hero-cta">
          <Link href="/contribute" className="button-link">
            Contribute Template
          </Link>
        </div>
      </section>

      <aside className="panel-side card compact">
        <h2>Featured Templates</h2>
        <FeaturedTemplates items={items} error={error} />
      </aside>
    </main>
  );
}
