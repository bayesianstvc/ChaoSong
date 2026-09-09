/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { FullPageLink as Link } from "@/components/full-page-link";
import { PageIntro } from "@/components/page-intro";
import { formatDate, posts } from "@/lib/content";
import { getPublishedEntrySummariesOrFallback, getPublishedEntryOrFallback } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Chao Song | Blogs",
  description: "Research notes, science communication, and bilingual blog posts.",
  alternates: { canonical: "/blogs" },
  openGraph: { images: ["/og.png"] },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default async function BlogsPage({ searchParams }: { searchParams: Promise<{ q?: string; year?: string }> }) {
  const [managedPosts, page] = await Promise.all([
    getPublishedEntrySummariesOrFallback("journal"),
    getPublishedEntryOrFallback("page", "journal"),
  ]);
  const merged = [
    ...managedPosts.map((post) => ({ slug: post.slug, title: post.title, date: post.date, language: post.language, managed: true })),
    ...posts.map((post) => ({ slug: post.slug, title: post.title, date: post.date, language: post.language, managed: false })),
  ];
  const items = [...new Map(merged.map((item) => [item.slug, item])).values()].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLocaleLowerCase();
  const years = [...new Set(items.map((item) => item.date?.slice(0, 4)).filter(Boolean))] as string[];
  const selectedYear = years.includes(params.year ?? "") ? params.year ?? "" : "";
  const visibleItems = items.filter((item) => (!selectedYear || item.date?.startsWith(selectedYear)) && (!query || `${item.title} ${item.language}`.toLocaleLowerCase().includes(query)));
  return (
    <div className="inner-page">
      <PageIntro
        index="06"
        title={page?.title?.replace(/Journal/gi, "Blogs") ?? "Blogs / 博客"}
        lede={page?.summary ?? "Long-form research notes, invited science communication, and archived institutional news in their original languages."}
        media={<img src="/design/card-news.webp" alt="Blogs visual" loading="eager" decoding="async" />}
      />
      <form className="collection-search" method="get"><label><span>Search blogs</span><input name="q" defaultValue={params.q ?? ""} placeholder="Title or keyword" /></label>{selectedYear ? <input type="hidden" name="year" value={selectedYear} /> : null}<button type="submit">Search</button>{query || selectedYear ? <Link href="/blogs">Clear</Link> : null}</form>
      <nav className="collection-year-filter" aria-label="Blog years"><Link className={!selectedYear ? "active" : ""} href={`/blogs${query ? `?q=${encodeURIComponent(query)}` : ""}`}>All years</Link>{years.map((year) => <Link className={selectedYear === year ? "active" : ""} href={`/blogs?year=${year}${query ? `&q=${encodeURIComponent(query)}` : ""}`} key={year}>{year}</Link>)}</nav>
      <div className="journal-index">
        {visibleItems.map((post, index) => (
          <Link href={`/blogs/${post.slug}`} key={post.slug} lang={post.language}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <time>{formatDate(post.date)}</time>
            <h2>{post.title}</h2>
            <p>{post.managed ? (post.language === "zh" ? "中文 · MDX" : "English · MDX") : (post.language === "zh" ? "中文原文" : "English original")}</p>
          </Link>
        ))}
        {!visibleItems.length ? <p className="collection-empty">No matching blogs.</p> : null}
      </div>
    </div>
  );
}
