import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/page-intro";
import { ManagedArticle } from "@/components/managed-article";
import { SourceArticle } from "@/components/source-article";
import { formatDate, getPost, posts } from "@/lib/content";

import { getPublishedEntryOrFallback, getPublishedEntrySummariesOrFallback, getStudioEntry } from "@/lib/cms";
import { SocialShare } from "@/components/social-share";
import { ArticlePagination, type ArticleNavigationItem } from "@/components/article-pagination";

export const dynamic = "force-dynamic";



export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const managed = await getPublishedEntryOrFallback("journal", decoded);
  const post = getPost(decoded);
  const title = managed?.title ?? post?.title ?? "Blogs";
  const description = managed && "seoDescription" in managed ? managed.seoDescription ?? managed.summary : managed?.summary;
  return {
    title: `Chao Song | ${title}`,
    description,
    alternates: { canonical: `/blogs/${decoded}` },
    openGraph: { type: "article", title, description, images: ["/og.png"] },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}

export default async function BlogArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const managed = await getPublishedEntryOrFallback("journal", decoded);
  const managedSummaries = await getPublishedEntrySummariesOrFallback("journal");
  const blogEntries = mergeBlogEntries(managedSummaries, posts);
  const currentIndex = blogEntries.findIndex((entry) => entry.slug === decoded);
  const previous = currentIndex > 0 ? blogEntries[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < blogEntries.length - 1 ? blogEntries[currentIndex + 1] : null;
  const related = blogEntries.filter((entry) => entry.slug !== decoded).slice(0, 3).map((entry) => ({ ...entry, summary: entry.summary || "Read this article" }));
  if (managed) return <div className="inner-page"><PageIntro index={formatDate(managed.date)} title={managed.title} lede={managed.summary} /><SocialShare title={managed.title} /><ManagedArticle entry={managed} /><ArticlePagination previous={previous} next={next} /><RelatedBlogs entries={related} /></div>;
  let studioEntry: Awaited<ReturnType<typeof getStudioEntry>> = null;
  try { studioEntry = await getStudioEntry(`journal:${decoded}`); }
  catch { /* A missing local D1 keeps the bundled public fallback available. */ }
  if (studioEntry && studioEntry.status !== "published") notFound();
  const post = getPost(decoded);
  if (!post) notFound();
  return <div className="inner-page"><PageIntro index={formatDate(post.date)} title={post.title} /><SocialShare title={post.title} /><SourceArticle item={post} /><ArticlePagination previous={previous} next={next} /><RelatedBlogs entries={related} /></div>;
}

function mergeBlogEntries(managed: Awaited<ReturnType<typeof getPublishedEntrySummariesOrFallback>>, bundled: typeof posts): Array<ArticleNavigationItem & { summary: string }> {
  const merged = [
    ...managed.map((entry) => ({ slug: entry.slug, href: `/blogs/${entry.slug}`, title: entry.title, summary: entry.summary, date: entry.date })),
    ...bundled.map((entry) => ({ slug: entry.slug, href: `/blogs/${entry.slug}`, title: entry.title, summary: entry.headings.slice(0, 2).join(" · "), date: entry.date })),
  ];
  return [...new Map(merged.map((entry) => [entry.slug, entry])).values()].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

function RelatedBlogs({ entries }: { entries: Array<{ slug: string; title: string; summary: string; date: string | null }> }) {
  if (!entries.length) return null;
  return <section className="related-blogs" aria-labelledby="related-blogs-title"><p className="managed-label">Continue reading</p><h2 id="related-blogs-title">More from the blog</h2><div>{entries.map((entry) => <article key={entry.slug}><small>{formatDate(entry.date)}</small><h3><Link href={`/blogs/${entry.slug}`}>{entry.title}</Link></h3><p>{entry.summary}</p></article>)}</div></section>;
}
