'use client';

import Link from 'next/link';
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

type LocalProfile = {
  name: string;
};

function readOwnerRef(): string {
  const profileRaw = localStorage.getItem('templatedb_profile_v1');
  if (profileRaw) {
    try {
      const parsed = JSON.parse(profileRaw) as Partial<LocalProfile>;
      if (typeof parsed.name === 'string' && parsed.name.trim().length >= 2) {
        return parsed.name.trim();
      }
    } catch (error) {
      console.error('Failed to parse local profile:', error);
    }
  }

  const legacy = localStorage.getItem('tdb-user-id') ?? '';
  return legacy.trim();
}

export default function TemplateDetail({ params }: { params: { slug: string } }) {
  const [template, setTemplate] = useState<Template | null>(null);
  const [ownerRef, setOwnerRef] = useState('');
  const [note, setNote] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOwnerRef(readOwnerRef());
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadTemplate() {
      setLoading(true);
      setInfo('');

      try {
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
      } catch (error) {
        if (!mounted) return;
        console.error('Template detail load failed:', error);
        setTemplate(null);
        setInfo(error instanceof Error ? error.message : 'Unknown load error');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadTemplate().catch((error) => console.error('Unexpected template load error:', error));

    return () => {
      mounted = false;
    };
  }, [params.slug]);

  const remixHref = useMemo(() => {
    if (!template) return '/contribute';

    const paramsForRemix = new URLSearchParams({
      title: `${template.title} Remix`,
      summary: template.summary,
      content: template.content,
      type: template.type,
      tags: template.tags.join(' ')
    });

    return `/contribute?${paramsForRemix.toString()}`;
  }, [template]);

  const canContribute = useMemo(() => {
    if (!template || !ownerRef) return false;
    return template.owner.username !== ownerRef && template.ownerId !== ownerRef;
  }, [template, ownerRef]);

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
      body: JSON.stringify({
        templateRef: template.slug,
        contributorRef: ownerRef,
        message: note || `Contribute request untuk ${template.title}`
      })
    });

    const payload = await res.json();
    setInfo(res.ok ? 'Permintaan contribute terkirim.' : payload.error ?? 'Gagal mengirim kontribusi.');
  }

  async function quickFork() {
    if (!template || !ownerRef) {
      setInfo('Isi username/profile dulu untuk fork.');
      return;
    }

    const res = await fetch(`/api/templates/${encodeURIComponent(template.slug)}/fork`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerRef })
    });

    const payload = await res.json();
    if (!res.ok) {
      setInfo(payload.error ?? 'Gagal melakukan fork template.');
      return;
    }

    setInfo('Fork berhasil dibuat. Mengalihkan ke hasil fork...');
    window.location.href = `/template/${payload.slug}`;
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

        <div className="space" />
        <input
          value={ownerRef}
          onChange={(e) => setOwnerRef(e.target.value)}
          placeholder="Username kamu (untuk fork & contribute)"
        />

        <div className="space" />
        <div className="row">
          <button onClick={copyTemplate}>Copy</button>
          <button onClick={quickFork}>Quick Fork</button>
          <Link className="button-link subtle" href={remixHref}>Fork / Remix Editor</Link>
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
    </main>
  );
}
