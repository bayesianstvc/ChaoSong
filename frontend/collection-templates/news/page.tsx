import type { Metadata } from 'next';
import { PageIntro } from '@/components/page-intro';
import { formatDate } from '@/lib/content';
import { getPublishedEntrySummariesOrFallback, getPublishedEntryOrFallback } from '@/lib/cms';
import { NewsCollection } from '../_static-collections/news-client';
import { getLegacyNewsArchive } from '../_static-collections/legacy-news';
import type { NewsItem } from '../_static-collections/types';

export const metadata: Metadata = {
  title: 'Chao Song | News',
  description: 'Latest research news and the complete 2016–2025 public news archive.',
  alternates: { canonical: '/news' },
  openGraph: { images: ['/og.png'] },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
};

export default async function NewsPage() {
  const [latestNews, publications, page] = await Promise.all([
    getPublishedEntrySummariesOrFallback('news'),
    getPublishedEntrySummariesOrFallback('publication'),
    getPublishedEntryOrFallback('page', 'news'),
  ]);
  const managed: NewsItem[] = [
    ...latestNews.map((entry) => ({ slug: entry.slug, title: entry.title, summary: entry.summary ?? '', date: entry.date ?? null, updated: entry.updated, dateLabel: formatDate(entry.date ?? null), newsKind: 'news' as const })),
    ...publications.map((entry) => ({ slug: entry.slug, title: entry.title, summary: entry.summary ?? '', date: entry.date ?? null, updated: entry.updated, dateLabel: formatDate(entry.date ?? null), newsKind: 'publication' as const })),
  ];
  const items = [...new Map(managed.map((entry) => [`${entry.newsKind}:${entry.slug}`, entry])).values()]
    .sort((left, right) => (right.date ?? right.updated ?? '').localeCompare(left.date ?? left.updated ?? ''));
  const archiveYears = getLegacyNewsArchive().years;
  const managedYears = items.map((entry) => Number((entry.date ?? entry.updated ?? '').slice(0, 4))).filter((year) => Number.isInteger(year) && year >= 2000);
  const years = [...new Set([new Date().getFullYear(), ...managedYears, ...archiveYears])].sort((left, right) => right - left);
  return <div className="inner-page">
    <PageIntro index="05" title={page?.title ?? 'News Archive'} lede={page?.summary ?? 'Short research updates organised by year, with one focused archive view at a time.'} media={<img src="/design/card-news.webp" alt="News and research updates" loading="eager" />} />
    <NewsCollection items={items} years={years} archiveYears={archiveYears} />
  </div>;
}
