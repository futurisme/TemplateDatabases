'use client';

import { useEffect, useState } from 'react';
import { TemplateCard } from './TemplateCard';

type SearchResult = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: string;
  tags: string[];
  score: number;
};

export function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        setError('');
        return;
      }

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
    }, 160);

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <section className="card">
      <h2>Smart Search</h2>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari template: code, ide, cerita, dll..."
      />
      <div className="space" />
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
