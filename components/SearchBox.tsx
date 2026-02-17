'use client';

import { useEffect, useState } from 'react';
import { TemplateCard } from '@/components/TemplateCard';

type SearchResult = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: string;
  tags: string[];
  owner?: { displayName: string };
};

export function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError('');
      return;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal, cache: 'no-store' });
      const payload = (await res.json().catch(() => ({ error: `Invalid API response (${res.status})` }))) as
        | SearchResult[]
        | { error?: string };

      if (!res.ok) {
        setResults([]);
        setError(Array.isArray(payload) ? `Request failed (${res.status})` : payload.error ?? 'Search request failed');
        return;
      }

      setError('');
      setResults(Array.isArray(payload) ? payload : []);
    }, 140);

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <section className="card compact search-shell">
      <h2>Search</h2>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari template: code, ide, cerita, dll..."
      />
      {error && <p className="muted">{error}</p>}
      {results.length > 0 && (
        <div className="grid">
          {results.map((item) => (
            <TemplateCard key={item.id} template={{ ...item, featured: false }} />
          ))}
        </div>
      )}
    </section>
  );
}
