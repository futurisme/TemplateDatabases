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
const filterModes: FilterType[] = ['ALL', 'CODE', 'IDEA', 'STORY', 'OTHER'];
const sortOptions: Array<{ value: SortMode; label: string; description: string }> = [
  { value: 'relevance', label: 'Relevance', description: 'Paling relevan dengan query' },
  { value: 'newest', label: 'Newest', description: 'Template terbaru lebih dulu' }
];

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function parseSearchPayload(text: string): SearchPayload {
  if (!text) return [];

  try {
    return JSON.parse(text) as SearchPayload;
  } catch (error) {
    console.error('Invalid search API JSON payload:', error, text);
    return { error: 'Invalid API response' };
  }
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
  return Array.from(instantPool.values())
    .map((item) => ({ item, score: localRank(item, query, type) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (sort === 'newest') return 0;
      return b.score - a.score;
    })
    .slice(0, 20)
    .map((entry) => entry.item);
}

function cycleFilter(current: FilterType): FilterType {
  const nextIndex = (filterModes.indexOf(current) + 1) % filterModes.length;
  return filterModes[nextIndex];
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
  const [isSortPanelOpen, setIsSortPanelOpen] = useState(false);
  const sortPanelRef = useRef<HTMLDivElement | null>(null);
  const latestRequestId = useRef(0);

  const normalizedQuery = useMemo(() => normalizeQuery(query), [query]);

  useEffect(() => {
    setRecentSearches(safeReadArray(recentKey));
    setSavedSearches(safeReadArray(savedKey));
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!sortPanelRef.current) return;
      if (!sortPanelRef.current.contains(event.target as Node)) {
        setIsSortPanelOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSortPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();

    const warmup = async () => {
      try {
        const res = await fetch('/api/templates?featured=1', { signal: ctrl.signal, cache: 'force-cache' });
        const payload = parseSearchPayload(await res.text());
        if (res.ok && Array.isArray(payload)) registerPool(payload);
      } catch (error) {
        if (!isAbortError(error)) console.error('Search warmup failed:', error);
      }
    };

    warmup().catch((error) => {
      if (!isAbortError(error)) console.error('Search warmup failed:', error);
    });

    return () => {
      ctrl.abort();
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

        const payload = parseSearchPayload(await res.text());

        if (latestRequestId.current !== requestId) return;

        if (!res.ok) {
          setResults([]);
          setError(Array.isArray(payload) ? `Request failed (${res.status})` : payload.error ?? `Search request failed (${res.status})`);
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
        <div className="row">
          <button
            type="button"
            className="mini-icon-button"
            title={`Filter: ${filterType}`}
            aria-label={`Filter type ${filterType}. Klik untuk ganti.`}
            onClick={() => setFilterType((current) => cycleFilter(current))}
          >
            ◈
          </button>

          <div className="sort-menu" ref={sortPanelRef}>
            <button
              type="button"
              className="sort-trigger"
              onClick={() => setIsSortPanelOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={isSortPanelOpen}
            >
              Sort ▾
            </button>

            {isSortPanelOpen && (
              <div className="sort-popover" role="menu" aria-label="Sort By">
                <p className="sort-popover-title">Sort by</p>
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={option.value === sortMode ? 'sort-option active' : 'sort-option'}
                    onClick={() => {
                      setSortMode(option.value);
                      setIsSortPanelOpen(false);
                    }}
                  >
                    <span>{option.label}</span>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" className="button-link subtle" onClick={pinSearch}>
            Save query
          </button>
        </div>
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
