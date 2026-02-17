import Link from 'next/link';
import { ContributeGate } from '@/components/ContributeGate';

export const dynamic = 'force-dynamic';

export default function ContributePage() {
  return (
    <main className="page-shell">
      <section className="card compact">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1>Contribute Template</h1>
          <Link href="/" className="button-link subtle">
            Kembali ke Search
          </Link>
        </div>
        <p className="muted">Bagikan template baru untuk komunitas global TemplateDatabase.</p>
      </section>
      <ContributeGate />
    </main>
  );
}
