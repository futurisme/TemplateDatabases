'use client';

import { useEffect, useState } from 'react';
import { TemplateCard } from '@/components/TemplateCard';

type Item = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: string;
  tags: string[];
  featured: boolean;
  owner?: { displayName: string };
};

type ApiPayload = Item[] | { error?: string };

async function readJsonSafe(res: Response): Promise<ApiPayload> {
  const text = await res.text();
  if (!text) return [];

  try {
    return JSON.parse(text) as ApiPayload;
  } catch {
    return { error: `Invalid API response (${res.status})` };
  }
}

export function FeaturedTemplates() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();

    async function load() {
      setLoading(true);
      setError('');

      const res = await fetch('/api/templates?featured=1', {
        signal: ctrl.signal,
        cache: 'no-store'
      });

      const payload = await readJsonSafe(res);

      if (!res.ok) {
        setItems([]);
        setError(Array.isArray(payload) ? `Request failed (${res.status})` : payload.error ?? 'Gagal memuat featured templates');
        setLoading(false);
        return;
      }

      setItems(Array.isArray(payload) ? payload : []);
      setLoading(false);
    }

    load().catch((err: unknown) => {
      console.error('Featured templates fetch failed:', err);
      setItems([]);
      setError(err instanceof Error ? err.message : 'Unknown frontend error');
      setLoading(false);
    });

    return () => ctrl.abort();
  }, []);

  if (loading) {
    return <p className="muted">Memuat featured templates...</p>;
  }

  if (error) {
    return <p className="muted">{error}</p>;
  }

  if (items.length === 0) {
    return <p className="muted">Belum ada featured templates.</p>;
  }

  return (
    <div className="grid">
      {items.map((item) => (
        <TemplateCard key={item.id} template={item} />
      ))}
    </div>
  );
}
