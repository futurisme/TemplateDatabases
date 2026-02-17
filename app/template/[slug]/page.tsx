'use client';

import { useEffect, useMemo, useState } from 'react';

type Template = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  type: string;
  tags: string[];
  ownerId: string;
  owner: { id: string; displayName: string; username: string };
};

export default function TemplateDetail({ params }: { params: { slug: string } }) {
  const [template, setTemplate] = useState<Template | null>(null);
  const [userId, setUserId] = useState('');
  const [note, setNote] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('tdb-user-id') ?? '';
    setUserId(stored);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadTemplate() {
      setLoading(true);
      setInfo('');
      const res = await fetch(`/api/templates/${encodeURIComponent(params.slug)}`);
      const payload = await res.json();
      if (!mounted) return;

      if (!res.ok) {
        setTemplate(null);
        setInfo(payload.error ?? 'Gagal memuat template');
        setLoading(false);
        return;
      }

      setTemplate(payload as Template);
      setLoading(false);
    }

    loadTemplate().catch((error: unknown) => {
      console.error('Template detail load failed:', error);
      if (mounted) {
        setTemplate(null);
        setInfo(error instanceof Error ? error.message : 'Unknown load error');
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [params.slug]);

  const canContribute = useMemo(() => {
    if (!template || !userId) return false;
    return template.ownerId !== userId;
  }, [template, userId]);

  async function copyTemplate() {
    if (!template) return;
    await navigator.clipboard.writeText(template.content);
    setInfo('Konten template berhasil dicopy.');
  }

  async function sendContribution() {
    if (!template || !canContribute) return;
    const res = await fetch('/api/contributions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: template.id, userId, message: note || 'Contribute request' })
    });
    const payload = await res.json();
    setInfo(res.ok ? 'Permintaan contribute terkirim.' : payload.error ?? 'Gagal mengirim kontribusi.');
  }

  if (loading) {
    return (
      <main>
        <p>Loading template...</p>
      </main>
    );
  }

  if (!template) {
    return (
      <main>
        <p>Template tidak ditemukan.</p>
        {info && <p className="muted">{info}</p>}
      </main>
    );
  }

  return (
    <main>
      <article className="card">
        <h1>{template.title}</h1>
        <p className="muted">{template.summary}</p>
        <p>Owner: {template.owner.displayName}</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {template.tags.map((tag) => (
            <small key={tag} className="muted">
              #{tag}
            </small>
          ))}
        </div>
        <pre className="card" style={{ whiteSpace: 'pre-wrap' }}>
          {template.content}
        </pre>
        <div className="row">
          <button onClick={copyTemplate}>Copy</button>
          {canContribute && <button onClick={sendContribution}>Contribute</button>}
        </div>
        {canContribute && (
          <>
            <div className="space" />
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Pesan kontribusi" />
          </>
        )}
        {info && <p className="muted">{info}</p>}
      </article>
      <section className="card" style={{ marginTop: 12 }}>
        <h4>Set User Context</h4>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Isi user id agar tombol contribute aktif saat bukan owner"
        />
        <div className="space" />
        <button
          onClick={() => {
            localStorage.setItem('tdb-user-id', userId);
            setInfo('User context tersimpan.');
          }}
        >
          Simpan User ID
        </button>
      </section>
    </main>
  );
}
