'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TemplateCard } from '@/components/TemplateCard';

type SearchResult = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: 'CODE' | 'IDEA' | 'STORY' | 'OTHER';
  tags: string[];
  owner?: { displayName: string };
};

type SearchPayload = SearchResult[] | { error?: string };
type SortMode = 'relevance' | 'newest';
type FilterType = 'ALL' | 'CODE' | 'IDEA' | 'STORY' | 'OTHER';

const searchCache = new Map<string, SearchResult[]>();
const instantPool = new Map<string, SearchResult>();
const recentKey = 'tdb_recent_searches_v1';
const savedKey = 'tdb_saved_searches_v1';

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

function safeReadArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string').slice(0, 12);
  } catch (error) {
    console.error(`Failed to read localStorage key ${key}:`, error);
    return [];
  }
}

function writeArray(key: string, values: string[]) {
  localStorage.setItem(key, JSON.stringify(values.slice(0, 12)));
}

function localRank(item: SearchResult, query: string, type: FilterType): number {
  if (type !== 'ALL' && item.type !== type) return 0;

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

function instantSearch(query: string, type: FilterType, sort: SortMode): SearchResult[] {
  const ranked = Array.from(instantPool.values())
    .map((item) => ({ item, score: localRank(item, query, type) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (sort === 'newest') return 0;
      return b.score - a.score;
    })
    .slice(0, 20)
    .map((entry) => entry.item);

  return ranked;
}

export function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<string[]>([]);
  const latestRequestId = useRef(0);

  const normalizedQuery = useMemo(() => normalizeQuery(query), [query]);

  useEffect(() => {
    setRecentSearches(safeReadArray(recentKey));
    setSavedSearches(safeReadArray(savedKey));
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();

    const warmup = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/templates?featured=1', { signal: ctrl.signal, cache: 'force-cache' });
        const text = await res.text();
        const payload = text ? (JSON.parse(text) as SearchPayload) : [];
        if (res.ok && Array.isArray(payload)) registerPool(payload);
      } catch (error) {
        if (!isAbortError(error)) console.error('Search warmup failed:', error);
      }
    }, 0);

    return () => {
      ctrl.abort();
      window.clearTimeout(warmup);
    };
  }, []);

  useEffect(() => {
    setActiveIndex(-1);

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

    const cacheKey = `${normalizedQuery}|${filterType}|${sortMode}`;
    const fromCache = searchCache.get(cacheKey);
    if (fromCache) {
      setResults(fromCache);
      setError('');
      return;
    }

    const localResults = instantSearch(normalizedQuery, filterType, sortMode);
    if (localResults.length > 0) {
      setResults(localResults);
      setError('');
    }

    const ctrl = new AbortController();
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: normalizedQuery, sort: sortMode });
        if (filterType !== 'ALL') params.set('type', filterType);

        const res = await fetch(`/api/search?${params.toString()}`, {
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

        if (latestRequestId.current !== requestId) return;

        if (!res.ok) {
          setResults([]);
          setError(Array.isArray(payload) ? `Request failed (${res.status})` : payload.error ?? 'Search request failed');
          return;
        }

        const nextResults = Array.isArray(payload) ? payload : [];
        registerPool(nextResults);
        searchCache.set(cacheKey, nextResults);
        setError('');
        setResults(nextResults);
      } catch (requestError) {
        if (isAbortError(requestError)) return;
        console.error('Search request failed:', requestError);
        if (latestRequestId.current !== requestId) return;
        if (localResults.length > 0) return;
        setResults([]);
        setError(requestError instanceof Error ? requestError.message : 'Search request failed');
      }
    }, 35);

    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [normalizedQuery, filterType, sortMode]);

  function pinSearch() {
    if (!normalizedQuery) return;
    const next = [normalizedQuery, ...savedSearches.filter((item) => item !== normalizedQuery)].slice(0, 12);
    setSavedSearches(next);
    writeArray(savedKey, next);
  }

  function commitRecent(term: string) {
    if (!term) return;
    const next = [term, ...recentSearches.filter((item) => item !== term)].slice(0, 12);
    setRecentSearches(next);
    writeArray(recentKey, next);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      const target = results[activeIndex];
      if (target) {
        commitRecent(normalizedQuery);
        window.location.href = `/template/${target.slug}`;
      }
    }
  }

  return (
    <section className="card compact search-shell">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Search</h2>
        <button type="button" className="button-link subtle" onClick={pinSearch}>
          Save query
        </button>
      </div>

      <div className="row">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as FilterType)}>
          <option value="ALL">All Types</option>
          <option value="CODE">CODE</option>
          <option value="IDEA">IDEA</option>
          <option value="STORY">STORY</option>
          <option value="OTHER">OTHER</option>
        </select>
        <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
          <option value="relevance">Relevance</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commitRecent(normalizedQuery)}
        placeholder="Cari template: code, ide, cerita, dll..."
      />

      {(recentSearches.length > 0 || savedSearches.length > 0) && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {savedSearches.slice(0, 4).map((item) => (
            <button key={`saved-${item}`} type="button" className="chip" onClick={() => setQuery(item)}>
              ★ {item}
            </button>
          ))}
          {recentSearches.slice(0, 4).map((item) => (
            <button key={`recent-${item}`} type="button" className="chip" onClick={() => setQuery(item)}>
              {item}
            </button>
          ))}
        </div>
      )}

      {error && <p className="muted">{error}</p>}
      {results.length > 0 && (
        <div className="grid">
          {results.map((item, index) => (
            <div key={item.id} className={index === activeIndex ? 'active-result' : ''}>
              <TemplateCard template={{ ...item, featured: false }} />
            </div>
          ))}
        </div>
      )}
      {activeIndex >= 0 && results[activeIndex] && (
        <p className="muted">
          Enter untuk buka: <Link href={`/template/${results[activeIndex].slug}`}>{results[activeIndex].title}</Link>
        </p>
      )}
    </section>
  );
}
