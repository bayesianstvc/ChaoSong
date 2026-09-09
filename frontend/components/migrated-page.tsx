import { PageIntro } from "@/components/page-intro";
import { SourceArticle } from "@/components/source-article";
import { getPage } from "@/lib/content";
import { getPublishedEntriesOrFallback, getPublishedEntryOrFallback } from "@/lib/cms";
import type { EditorialType } from "@/lib/editorial";
import type { ReactNode } from "react";
import { mergeCompleteHtml, usesUnifiedFinalContent } from "@/lib/content-merge";
import { safePublicHref } from "@/lib/public-href";

export async function MigratedPage({
  slug,
  index,
  title,
  lede,
  html,
  managedSlug,
  collectionType,
  beforeContent,
  introMedia,
  introAction,
  hideOriginalContent = false,
  hideManagedContent = false,
}: {
  slug: string;
  index: string;
  title: string;
  lede?: string;
  html?: string;
  managedSlug?: string;
  collectionType?: EditorialType;
  beforeContent?: ReactNode;
  introMedia?: ReactNode;
  introAction?: ReactNode;
  hideOriginalContent?: boolean;
  hideManagedContent?: boolean;
}) {
  const item = getPage(slug);
  const managed = managedSlug
    ? await getPublishedEntryOrFallback("page", managedSlug)
    : undefined;
  const collection = collectionType ? await getPublishedEntriesOrFallback(collectionType) : [];
  const showManagedContent = Boolean(managed && !hideManagedContent);
  if (!item) return null;
  const managedHtml = showManagedContent && managed ? managed.html : "";
  const bundledHtml = hideOriginalContent ? "" : html ?? item.contentHtml;
  const legacyHtml = managed && "originalHtml" in managed && managed.originalHtml
    ? String(managed.originalHtml)
    : bundledHtml;
  const completeHtml = showManagedContent && managed && usesUnifiedFinalContent(managed.type, managed.slug)
    ? mergeCompleteHtml(managedHtml, legacyHtml)
    : showManagedContent
      ? managedHtml
      : bundledHtml;
  return (
    <div className="inner-page">
      <PageIntro
        index={index}
        title={managed?.title ?? title}
        lede={managed?.summary ?? lede}
        media={introMedia}
        action={introAction}
      />
      {beforeContent}
      {collection.length ? <section className="managed-collection" aria-label={`${collectionType} collection`}>
        <p className="managed-label">Explore related work</p>
        <div className="studio-public-collection">
          {collection.map((entry) => <article id={entry.slug} key={entry.slug}>
            <small>{entry.date ?? entry.updated}</small>
            <h2>{entry.title}</h2>
            <p>{entry.summary}</p>
            {safePublicHref(entry.href) ? <a href={safePublicHref(entry.href)!}>Explore ↗</a> : null}
          </article>)}
        </div>
      </section> : null}
      {completeHtml ? <SourceArticle item={item} html={completeHtml} /> : null}
    </div>
  );
}
