import Link from 'next/link';
import { headers } from 'next/headers';
import { SearchBox } from '@/components/SearchBox';
import { FeaturedTemplates, type FeaturedItem } from '@/components/FeaturedTemplates';

export const dynamic = 'force-dynamic';

type FeaturedPayload = FeaturedItem[] | { error?: string };

async function getFeaturedTemplates(): Promise<{ items: FeaturedItem[]; error?: string }> {
  try {
    const headerStore = headers();
    const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host');
    const proto = headerStore.get('x-forwarded-proto') ?? 'http';
    const baseUrl = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_BASE_URL;

    if (!baseUrl) {
      return { items: [], error: 'Featured belum tersedia.' };
    }

    const res = await fetch(`${baseUrl}/api/templates?featured=1`, {
      next: { revalidate: 120 }
    });
    const text = await res.text();
    const payload = text ? (JSON.parse(text) as FeaturedPayload) : [];

    if (!res.ok) {
      return {
        items: [],
        error: Array.isArray(payload) ? `Request failed (${res.status})` : payload.error ?? 'Gagal memuat featured templates'
      };
    }

    return { items: Array.isArray(payload) ? payload : [] };
  } catch (error) {
    console.error('Failed to load featured templates on server:', error);
    return { items: [], error: 'Featured belum tersedia.' };
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
