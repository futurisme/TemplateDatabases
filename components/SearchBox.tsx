'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

type SearchPayload = SearchResult[] | { error?: string };

const searchCache = new Map<string, SearchResult[]>();

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState('');
  const latestRequestId = useRef(0);

  const normalizedQuery = useMemo(() => normalizeQuery(query), [query]);

  useEffect(() => {
    if (!normalizedQuery) {
      setResults([]);
      setError('');
      return;
    }

    if (normalizedQuery.length < 2) {
      setResults([]);
      setError('Masukkan minimal 2 karakter.');
      return;
    }

    const cached = searchCache.get(normalizedQuery);
    if (cached) {
      setResults(cached);
      setError('');
      return;
    }

    const ctrl = new AbortController();
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(normalizedQuery)}`, {
          signal: ctrl.signal,
          cache: 'force-cache'
        });

        const text = await res.text();
        let payload: SearchPayload;
        try {
          payload = text ? (JSON.parse(text) as SearchPayload) : [];
        } catch (parseError) {
          console.error('Invalid search API JSON payload:', parseError, text);
          payload = { error: `Invalid API response (${res.status})` };
        }

        if (latestRequestId.current !== requestId) {
          return;
        }

        if (!res.ok) {
          setResults([]);
          setError(Array.isArray(payload) ? `Request failed (${res.status})` : payload.error ?? 'Search request failed');
          return;
        }

        const nextResults = Array.isArray(payload) ? payload : [];
        searchCache.set(normalizedQuery, nextResults);
        setError('');
        setResults(nextResults);
      } catch (requestError) {
        if (isAbortError(requestError)) {
          return;
        }

        console.error('Search request failed:', requestError);

        if (latestRequestId.current !== requestId) {
          return;
        }

        setResults([]);
        setError(requestError instanceof Error ? requestError.message : 'Search request failed');
      }
    }, 60);

    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [normalizedQuery]);

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
