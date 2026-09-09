import type { Metadata } from 'next';
import { PageIntro } from '@/components/page-intro';
import { getPublishedEntryOrFallback, getPublishedEntrySummariesOrFallback } from '@/lib/cms';
import { ResourcesCollection } from '../_static-collections/resources-client';

export async function generateMetadata(): Promise<Metadata> {
  const entry = await getPublishedEntryOrFallback('page', 'resources');
  return { title: 'Chao Song | Resources', description: entry && 'seoDescription' in entry ? entry.seoDescription ?? entry.summary : entry?.summary };
}

export default async function ResourcesPage() {
  const [page, resources] = await Promise.all([getPublishedEntryOrFallback('page', 'resources'), getPublishedEntrySummariesOrFallback('resource')]);
  const items = resources.map((entry) => ({ slug: entry.slug, title: entry.title, summary: entry.summary ?? '', date: entry.date, updated: entry.updated }));
  return <div className="inner-page"><PageIntro index="04" title={page?.title ?? 'Data & Resources'} lede={page?.summary ?? 'Datasets, software, documentation, and reproducible resources.'} media={<img src="/design/card-resources.webp" alt="Research data, software, documentation, and teaching resources" loading="eager" decoding="async" />} /><ResourcesCollection items={items} /></div>;
}
