import { NewTemplateForm } from '@/components/NewTemplateForm';
import { SearchBox } from '@/components/SearchBox';
import { FeaturedTemplates } from '@/components/FeaturedTemplates';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <main>
      <section>
        <h1>TemplateDatabase</h1>
        <p className="muted">
          Open source template hub global: simpan template universal (kode, ide, cerita, dan lainnya)
          dengan performa ringan, smart search, dan deployment 100% free-tier friendly (Vercel + Railway).
        </p>
      </section>
      <div className="space" />
      <SearchBox />
      <div className="space" />
      <section className="card">
        <h2>Featured Templates</h2>
        <FeaturedTemplates />
      </section>
      <div className="space" />
      <NewTemplateForm />
    </main>
  );
}
