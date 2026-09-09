'use client';

import { FullPageLink as Link } from '@/components/full-page-link';
import { useCollectionQuery } from './query';
import type { BlogItem } from './types';

export function BlogsCollection({ items, years }: { items: BlogItem[]; years: string[] }) {
  const { params, query, submit } = useCollectionQuery();
  const selectedYear = years.includes(params.year) ? params.year : '';
  const visibleItems = items.filter((item) => (!selectedYear || item.date?.startsWith(selectedYear)) && (!query || `${item.title} ${item.language}`.toLocaleLowerCase().includes(query)));
  return <>
    <form className="collection-search" method="get" onSubmit={submit}><label><span>Search blogs</span><input key={params.q} name="q" defaultValue={params.q} placeholder="Title or keyword" /></label>{selectedYear ? <input type="hidden" name="year" value={selectedYear} /> : null}<button type="submit">Search</button>{query || selectedYear ? <Link href="/blogs">Clear</Link> : null}</form>
    <nav className="collection-year-filter" aria-label="Blog years"><Link className={!selectedYear ? 'active' : ''} href={`/blogs${query ? `?q=${encodeURIComponent(query)}` : ''}`}>All years</Link>{years.map((year) => <Link className={selectedYear === year ? 'active' : ''} href={`/blogs?year=${year}${query ? `&q=${encodeURIComponent(query)}` : ''}`} key={year}>{year}</Link>)}</nav>
    <div className="journal-index">{visibleItems.map((post, index) => <Link href={`/blogs/${post.slug}`} key={post.slug} lang={post.language}><span>{String(index + 1).padStart(2, '0')}</span><time>{post.dateLabel}</time><h2>{post.title}</h2><p>{post.managed ? (post.language === 'zh' ? '中文 · MDX' : 'English · MDX') : (post.language === 'zh' ? '中文原文' : 'English original')}</p></Link>)}{!visibleItems.length ? <p className="collection-empty">No matching blogs.</p> : null}</div>
  </>;
}
