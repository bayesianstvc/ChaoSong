'use client';

import { FullPageLink as Link } from '@/components/full-page-link';
import { useCollectionQuery } from './query';
import type { NewsItem } from './types';

export function NewsCollection({ items, years, archiveYears }: { items: NewsItem[]; years: number[]; archiveYears: number[] }) {
  const { params, query, submit } = useCollectionQuery();
  const requestedYear = Number(params.year);
  const selectedYear = years.includes(requestedYear) ? requestedYear : null;
  const visibleItems = items.filter((entry) => (!selectedYear || Number((entry.date ?? entry.updated ?? '').slice(0, 4)) === selectedYear) && (!query || `${entry.title} ${entry.summary}`.toLocaleLowerCase().includes(query)));
  const visibleArchives = archiveYears.filter((year) => (!selectedYear || selectedYear === year) && !query);
  return <>
    <form className="collection-search" method="get" onSubmit={submit}><label><span>Search news</span><input key={params.q} name="q" defaultValue={params.q} placeholder="Title, summary, or keyword" /></label>{selectedYear ? <input type="hidden" name="year" value={selectedYear} /> : null}<button type="submit">Search</button>{query || selectedYear ? <Link href="/news">Clear</Link> : null}</form>
    <nav className="news-year-nav" aria-label="News archive years"><Link className={!selectedYear ? 'active' : ''} href={`/news${query ? `?q=${encodeURIComponent(query)}` : ''}`}>All</Link>{years.map((year) => <Link key={year} className={year === selectedYear ? 'active' : ''} href={`/news?year=${year}${query ? `&q=${encodeURIComponent(query)}` : ''}`}>{year}</Link>)}</nav>
    {visibleItems.length ? <section className="managed-collection" aria-labelledby="latest-news-heading"><p className="managed-label">News{selectedYear ? ` · ${selectedYear}` : ''}</p><h2 id="latest-news-heading">Latest updates</h2><ol className="timeline-list managed-timeline">{visibleItems.map((entry) => <li key={`${entry.newsKind}:${entry.slug}`} id={entry.slug}><time>{entry.dateLabel}</time><p><Link href={`/${entry.newsKind === 'publication' ? 'publications' : 'news'}/${entry.slug}`}>{entry.title}</Link></p><em>{entry.newsKind === 'publication' ? 'Publication' : 'News'}</em>{entry.summary ? <small>{entry.summary}</small> : null}</li>)}</ol></section> : null}
    {visibleArchives.length ? <section className="managed-collection news-annual-archives" aria-labelledby="annual-news-heading"><p className="managed-label">News archive</p><h2 id="annual-news-heading">Annual news posts</h2><nav className="news-annual-grid" aria-label="Annual news posts">{visibleArchives.map((year) => <Link key={year} href={`/news/archive/${year}`}><strong>{year}</strong><span>Open archive ↗</span></Link>)}</nav></section> : null}
    {!visibleItems.length && !visibleArchives.length ? <p className="collection-empty">No matching news.</p> : null}
  </>;
}
