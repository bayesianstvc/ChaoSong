'use client';

import { FullPageLink as Link } from '@/components/full-page-link';
import { useCollectionQuery } from './query';
import type { ResourceItem } from './types';

export function ResourcesCollection({ items }: { items: ResourceItem[] }) {
  const { params, query, submit } = useCollectionQuery();
  const visibleResources = items.filter((entry) => !query || `${entry.title} ${entry.summary}`.toLocaleLowerCase().includes(query));
  return <><form className="collection-search" method="get" onSubmit={submit}><label><span>Search resources</span><input key={params.q} name="q" defaultValue={params.q} placeholder="Title, summary, or keyword" /></label><button type="submit">Search</button>{query ? <Link href="/resources">Clear</Link> : null}</form><section className="managed-collection resource-index" aria-label="Resources"><div className="studio-public-collection">{visibleResources.map((entry) => <article key={entry.slug}><small>{entry.date ?? entry.updated}</small><h2>{entry.title}</h2><p>{entry.summary}</p><Link href={`/resources/${entry.slug}`}>Explore ↗</Link></article>)}{!visibleResources.length ? <p className="collection-empty">No matching resources.</p> : null}</div></section></>;
}
