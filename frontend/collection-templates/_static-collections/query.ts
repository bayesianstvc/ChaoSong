'use client';

import { useEffect, useState, type FormEvent } from 'react';

/** The static HTML renders the complete collection; hydration reads browser query parameters. */
export function useCollectionQuery() {
  const [params, setParams] = useState({ q: '', year: '' });
  useEffect(() => {
    const read = () => {
      const search = new URLSearchParams(window.location.search);
      setParams({ q: search.get('q') ?? '', year: search.get('year') ?? '' });
    };
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const url = new URL(window.location.href);
    const next = { q: String(data.get('q') ?? ''), year: String(data.get('year') ?? '') };
    if (next.q) url.searchParams.set('q', next.q); else url.searchParams.delete('q');
    if (next.year) url.searchParams.set('year', next.year); else url.searchParams.delete('year');
    window.history.pushState(null, '', url);
    setParams(next);
  }
  return { params, query: params.q.trim().toLocaleLowerCase(), submit };
}
