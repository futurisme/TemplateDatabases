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

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function readJsonSafe(res: Response): Promise<ApiPayload> {
  const text = await res.text();
  if (!text) return [];

  try {
    return JSON.parse(text) as ApiPayload;
  } catch (error) {
    console.error('Invalid featured templates JSON payload:', error, text);
    return { error: `Invalid API response (${res.status})` };
  }
}

export function FeaturedTemplates() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    let mounted = true;

    async function load() {
      if (!mounted) return;
      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/templates?featured=1', {
          signal: ctrl.signal,
          cache: 'force-cache'
        });

        const payload = await readJsonSafe(res);

        if (!res.ok) {
          if (!mounted) return;
          setItems([]);
          setError(Array.isArray(payload) ? `Request failed (${res.status})` : payload.error ?? 'Gagal memuat featured templates');
          return;
        }

        if (!mounted) return;
        setItems(Array.isArray(payload) ? payload : []);
      } catch (err: unknown) {
        if (isAbortError(err)) {
          return;
        }

        console.error('Featured templates fetch failed:', err);
        if (!mounted) return;
        setItems([]);
        setError(err instanceof Error ? err.message : 'Unknown frontend error');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load().catch((error: unknown) => {
      if (isAbortError(error)) {
        return;
      }

      console.error('Unexpected featured templates load error:', error);
      if (!mounted) return;
      setError(error instanceof Error ? error.message : 'Unknown frontend error');
      setLoading(false);
    });

    return () => {
      mounted = false;
      ctrl.abort();
    };
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
