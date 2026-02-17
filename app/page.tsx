import { getDb } from '@/lib/db';
import { NewTemplateForm } from '@/components/NewTemplateForm';
import { SearchBox } from '@/components/SearchBox';
import { TemplateCard } from '@/components/TemplateCard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const featured = await getDb().template.findMany({
    where: { featured: true },
    orderBy: { createdAt: 'desc' },
    take: 6,
    include: { owner: { select: { displayName: true } } }
  });

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
        <div className="grid">
          {featured.map((item) => (
            <TemplateCard key={item.id} template={item} />
          ))}
        </div>
      </section>
      <div className="space" />
      <NewTemplateForm />
    </main>
  );
}
