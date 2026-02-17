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

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
      if (res.ok) {
        const data = (await res.json()) as SearchResult[];
        setResults(data);
      }
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
