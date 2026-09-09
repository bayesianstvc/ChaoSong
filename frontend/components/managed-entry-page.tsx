/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import type { CmsEntry } from "@/lib/cms";
import { getPublishedEntryOrFallback, getPublishedEntrySummariesOrFallback } from "@/lib/cms";
import { formatDate } from "@/lib/content";
import { ManagedArticle } from "@/components/managed-article";
import { PageIntro } from "@/components/page-intro";
import { SocialShare } from "@/components/social-share";
import { ArticlePagination, type ArticleNavigationItem } from "@/components/article-pagination";

export async function ManagedEntryPage({ type, slug }: { type: CmsEntry["type"]; slug: string }) {
  const entry = await getPublishedEntryOrFallback(type, decodeURIComponent(slug));
  if (!entry) notFound();
  const entries = await getPublishedEntrySummariesOrFallback(type);
  const ordered = [...new Map([...entries, entry].map((item) => [item.slug, item])).values()].sort((left, right) => (right.date ?? "").localeCompare(left.date ?? ""));
  const index = ordered.findIndex((item) => item.slug === entry.slug);
  const previous = index > 0 ? toArticleNavigationItem(ordered[index - 1], type) : null;
  const next = index >= 0 && index < ordered.length - 1 ? toArticleNavigationItem(ordered[index + 1], type) : null;
  const introMedia = type === "resource"
    ? <img src="/design/card-resources.webp" alt="Research data, software, documentation, and teaching resources" loading="eager" decoding="async" />
    : undefined;
  return <div className="inner-page"><PageIntro index={formatDate(entry.date)} title={entry.title} lede={entry.summary} media={introMedia} /><SocialShare title={entry.title} /><ManagedArticle entry={entry} /><ArticlePagination previous={previous} next={next} /></div>;
}

function toArticleNavigationItem(entry: Pick<CmsEntry, "slug" | "title" | "date">, type: CmsEntry["type"]): ArticleNavigationItem {
  const prefix = type === "journal" ? "/blogs" : type === "publication" ? "/publications" : type === "resource" ? "/resources" : type === "research" ? "/research" : type === "news" ? "/news" : "/pages";
  return { slug: entry.slug, href: `${prefix}/${entry.slug}`, title: entry.title, date: entry.date };
}
