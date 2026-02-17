'use client';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <main>
      <section className="card">
        <h2>Terjadi masalah pada aplikasi</h2>
        <p className="muted">{error.message}</p>
        {error.digest && <small className="muted">Digest: {error.digest}</small>}
      </section>
    </main>
  );
}
