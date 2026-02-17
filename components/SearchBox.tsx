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
const instantPool = new Map<string, SearchResult>();

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

function registerPool(items: SearchResult[]) {
  for (const item of items) {
    instantPool.set(item.id, item);
  }
}

function localRank(item: SearchResult, query: string): number {
  const title = item.title.toLowerCase();
  const summary = item.summary.toLowerCase();
  const tags = item.tags.map((tag) => tag.toLowerCase());

  let score = 0;
  if (title === query) score += 120;
  if (title.startsWith(query)) score += 80;
  if (title.includes(query)) score += 35;
  if (summary.startsWith(query)) score += 20;
  if (summary.includes(query)) score += 10;
  if (tags.some((tag) => tag === query)) score += 65;
  if (tags.some((tag) => tag.startsWith(query))) score += 25;

  return score;
}

function instantSearch(query: string): SearchResult[] {
  const ranked = Array.from(instantPool.values())
    .map((item) => ({ item, score: localRank(item, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((entry) => entry.item);

  return ranked;
}

export function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState('');
  const latestRequestId = useRef(0);

  const normalizedQuery = useMemo(() => normalizeQuery(query), [query]);

  useEffect(() => {
    const ctrl = new AbortController();

    const warmup = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/templates?featured=1', { signal: ctrl.signal, cache: 'force-cache' });
        const text = await res.text();

        let payload: SearchPayload;
        try {
          payload = text ? (JSON.parse(text) as SearchPayload) : [];
        } catch (parseError) {
          console.error('Failed to parse featured warmup payload:', parseError, text);
          return;
        }

        if (res.ok && Array.isArray(payload)) {
          registerPool(payload);
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        console.error('Search warmup failed:', error);
      }
    }, 0);

    return () => {
      ctrl.abort();
      window.clearTimeout(warmup);
    };
  }, []);

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

    const fromCache = searchCache.get(normalizedQuery);
    if (fromCache) {
      setResults(fromCache);
      setError('');
      return;
    }

    const localResults = instantSearch(normalizedQuery);
    if (localResults.length > 0) {
      setResults(localResults);
      setError('');
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
        registerPool(nextResults);
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

        if (localResults.length > 0) {
          setError('');
          return;
        }

        setResults([]);
        setError(requestError instanceof Error ? requestError.message : 'Search request failed');
      }
    }, 40);

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
