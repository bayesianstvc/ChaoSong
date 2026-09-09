import type { Metadata } from "next";
import { FullPageLink as Link } from "@/components/full-page-link";
import { PageIntro } from "@/components/page-intro";
import { extractHtmlSection, formatDate, getPage } from "@/lib/content";
import { getPublishedEntrySummariesOrFallback, getPublishedEntryOrFallback } from "@/lib/cms";
import { extractNewsYearHtml, extractNewsYears, NEWS_ARCHIVE_YEARS } from "@/lib/news-archive";
import { mergeCompleteHtml } from "@/lib/content-merge";

export const metadata: Metadata = {
  title: "Chao Song | Home",
  description: "Latest research news and the complete 2016–2025 public news archive.",
  alternates: { canonical: "/news" },
  openGraph: { images: ["/og.png"] },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ year?: string; q?: string }> }) {
  const homepage = getPage("main-page");
  const newsHtml = homepage
    ? extractHtmlSection(homepage.contentHtml, "News (2016-2025)", "Related People")
    : undefined;
  const [latestNews, publications, page] = await Promise.all([getPublishedEntrySummariesOrFallback("news"), getPublishedEntrySummariesOrFallback("publication"), getPublishedEntryOrFallback("page", "news")]);
  if (!homepage) return null;
  const managed = [...latestNews.map((entry) => ({ ...entry, newsKind: "news" as const })), ...publications.map((entry) => ({ ...entry, newsKind: "publication" as const }))];
  const uniqueManaged = [...new Map(managed.map((entry) => [`${entry.newsKind}:${entry.slug}`, entry])).values()];
  const currentHtml = mergeCompleteHtml(page && !page.sourcePath.startsWith("builtin:") ? page.html : "", newsHtml ?? "");
  const archiveYears = extractNewsYears(currentHtml);
  const managedYears = uniqueManaged.map((entry) => Number((entry.date ?? entry.updated ?? "").slice(0, 4))).filter((year) => Number.isInteger(year) && year >= 2000);
  const years = [...new Set([new Date().getFullYear(), ...managedYears, ...archiveYears, ...NEWS_ARCHIVE_YEARS])].sort((left, right) => right - left);
  const params = await searchParams;
  const requestedYear = Number(params.year);
  const selectedYear = years.includes(requestedYear) ? requestedYear : null;
  const query = (params.q ?? "").trim().toLocaleLowerCase();
  const managedVisible = uniqueManaged.filter((entry) => (!selectedYear || Number((entry.date ?? entry.updated ?? "").slice(0, 4)) === selectedYear) && (!query || `${entry.title} ${entry.summary}`.toLocaleLowerCase().includes(query))).sort((left, right) => (right.date ?? right.updated ?? "").localeCompare(left.date ?? left.updated ?? ""));
  const visibleArchives = years.filter((year) => (!selectedYear || selectedYear === year) && !query && Boolean(extractNewsYearHtml(currentHtml, year)));
  return (
    <div className="inner-page">
      <PageIntro
        index="05"
        title={page?.title ?? "News Archive"}
        lede={page?.summary ?? "Short research updates organised by year, with one focused archive view at a time."}
        media={<img src="/design/card-news.webp" alt="News and research updates" loading="eager" />}
      />
      <form className="collection-search" method="get"><label><span>Search news</span><input name="q" defaultValue={params.q ?? ""} placeholder="Title, summary, or keyword" /></label>{selectedYear ? <input type="hidden" name="year" value={selectedYear} /> : null}<button type="submit">Search</button>{query || selectedYear ? <Link href="/news">Clear</Link> : null}</form>
      <nav className="news-year-nav" aria-label="News archive years">
        <Link className={!selectedYear ? "active" : ""} href={`/news${query ? `?q=${encodeURIComponent(query)}` : ""}`}>All</Link>{years.map((year) => <Link key={year} className={year === selectedYear ? "active" : ""} href={`/news?year=${year}${query ? `&q=${encodeURIComponent(query)}` : ""}`}>{year}</Link>)}
      </nav>
      {managedVisible.length ? <section className="managed-collection" aria-labelledby="latest-news-heading">
        <p className="managed-label">News{selectedYear ? ` · ${selectedYear}` : ""}</p>
        <h2 id="latest-news-heading">Latest updates</h2>
        <ol className="timeline-list managed-timeline">
          {managedVisible.map((entry) => (
            <li key={`${entry.newsKind}:${entry.slug}`} id={entry.slug}>
              <time>{formatDate(entry.date)}</time>
              <p><Link href={`/${entry.newsKind === "publication" ? "publications" : "news"}/${entry.slug}`}>{entry.title}</Link></p>
              <em>{entry.newsKind === "publication" ? "Publication" : "News"}</em>
              {entry.summary ? <small>{entry.summary}</small> : null}
            </li>
          ))}
        </ol>
      </section> : null}
      {visibleArchives.length ? <section className="managed-collection news-annual-archives" aria-labelledby="annual-news-heading">
        <p className="managed-label">News archive</p>
        <h2 id="annual-news-heading">Annual news posts</h2>
        <nav className="news-annual-grid" aria-label="Annual news posts">{visibleArchives.map((year) => <Link key={year} href={`/news/archive/${year}`}><strong>{year}</strong><span>Open archive ↗</span></Link>)}</nav>
      </section> : null}
    </div>
  );
}
