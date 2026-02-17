import Link from 'next/link';
import { SearchBox } from '@/components/SearchBox';
import { FeaturedTemplates } from '@/components/FeaturedTemplates';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero card compact">
        <p className="badge">TemplateDatabase</p>
        <h1>Temukan template terbaik secepat mesin pencari modern.</h1>
        <p className="muted hero-copy">
          Fokus utama pada pencarian cepat dan koleksi featured. Kontribusi template kini dipisah agar halaman utama
          lebih ringkas dan nyaman digunakan.
        </p>
        <div className="hero-cta">
          <Link href="/contribute" className="button-link">
            Contribute Template
          </Link>
        </div>
      </section>

      <section className="panel-grid">
        <div className="panel-main">
          <SearchBox />
        </div>
        <aside className="panel-side card compact">
          <h2>Featured Templates</h2>
          <FeaturedTemplates />
        </aside>
      </section>
    </main>
  );
}
