import type { Metadata } from 'next';
import { PageIntro } from '@/components/page-intro';
import { formatDate, posts } from '@/lib/content';
import { getPublishedEntrySummariesOrFallback, getPublishedEntryOrFallback } from '@/lib/cms';
import { BlogsCollection } from '../_static-collections/blogs-client';

export const metadata: Metadata = {
  title: 'Chao Song | Blogs', description: 'Research notes, science communication, and bilingual blog posts.',
  alternates: { canonical: '/blogs' }, openGraph: { images: ['/og.png'] },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
};

export default async function BlogsPage() {
  const [managedPosts, page] = await Promise.all([getPublishedEntrySummariesOrFallback('journal'), getPublishedEntryOrFallback('page', 'journal')]);
  // Current published records win over explicitly retained legacy posts with matching slugs.
  const merged = [
    ...posts.map((post) => ({ slug: post.slug, title: post.title, date: post.date ?? null, language: post.language ?? 'en', managed: false })),
    ...managedPosts.map((post) => ({ slug: post.slug, title: post.title, date: post.date ?? null, language: post.language ?? 'en', managed: true })),
  ];
  const items = [...new Map(merged.map((item) => [item.slug, item])).values()]
    .sort((left, right) => (right.date ?? '').localeCompare(left.date ?? ''))
    .map((item) => ({ ...item, dateLabel: formatDate(item.date) }));
  const years = [...new Set(items.map((item) => item.date?.slice(0, 4)).filter((year): year is string => Boolean(year)))].sort().reverse();
  return <div className="inner-page"><PageIntro index="06" title={page?.title?.replace(/Journal/gi, 'Blogs') ?? 'Blogs / 博客'} lede={page?.summary ?? 'Long-form research notes, invited science communication, and archived institutional news in their original languages.'} media={<img src="/design/card-news.webp" alt="Blogs visual" loading="eager" decoding="async" />} /><BlogsCollection items={items} years={years} /></div>;
}
