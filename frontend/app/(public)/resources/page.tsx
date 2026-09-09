/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";
import { FullPageLink as Link } from "@/components/full-page-link";
import { getPublishedEntryOrFallback, getPublishedEntrySummariesOrFallback } from "@/lib/cms";

export async function generateMetadata(): Promise<Metadata> {
  const entry = await getPublishedEntryOrFallback("page", "resources");
  return {
    title: "Chao Song | Home",
    description: entry && "seoDescription" in entry ? entry.seoDescription ?? entry.summary : entry?.summary,
  };
}

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [page, resources] = await Promise.all([getPublishedEntryOrFallback("page", "resources"), getPublishedEntrySummariesOrFallback("resource")]);
  const query = ((await searchParams).q ?? "").trim().toLocaleLowerCase();
  const visibleResources = resources.filter((entry) => !query || `${entry.title} ${entry.summary}`.toLocaleLowerCase().includes(query));
  return (
    <div className="inner-page">
      <PageIntro index="04" title={page?.title ?? "Data & Resources"} lede={page?.summary ?? "Datasets, software, documentation, and reproducible resources."} media={<img src="/design/card-resources.webp" alt="Research data, software, documentation, and teaching resources" loading="eager" decoding="async" />} />
      <form className="collection-search" method="get"><label><span>Search resources</span><input name="q" defaultValue={(await searchParams).q ?? ""} placeholder="Title, summary, or keyword" /></label><button type="submit">Search</button>{query ? <Link href="/resources">Clear</Link> : null}</form>
      <section className="managed-collection resource-index" aria-label="Resources">
        <div className="studio-public-collection">
          {visibleResources.map((entry) => <article key={entry.slug}>
            <small>{entry.date ?? entry.updated}</small>
            <h2>{entry.title}</h2>
            <p>{entry.summary}</p>
            <Link href={`/resources/${entry.slug}`}>Explore ↗</Link>
          </article>)}
          {!visibleResources.length ? <p className="collection-empty">No matching resources.</p> : null}
        </div>
      </section>
    </div>
  );
}
