import { notFound } from "next/navigation";
import { PageIntro } from "@/components/page-intro";
import { SourceArticle } from "@/components/source-article";
import { extractHtmlSection, getPage } from "@/lib/content";
import { getPublishedEntryOrFallback } from "@/lib/cms";
import { mergeCompleteHtml } from "@/lib/content-merge";
import { extractNewsYearHtml } from "@/lib/news-archive";

export const dynamic = "force-dynamic";

export default async function AnnualNewsPost({ params }: { params: Promise<{ year: string }> }) {
  const { year: value } = await params;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) notFound();
  const homepage = getPage("main-page");
  if (!homepage) notFound();
  const bundled = extractHtmlSection(homepage.contentHtml, "News (2016-2025)", "Related People") ?? "";
  const page = await getPublishedEntryOrFallback("page", "news");
  const complete = mergeCompleteHtml(page && !page.sourcePath.startsWith("builtin:") ? page.html : "", bundled);
  const html = extractNewsYearHtml(complete, year);
  if (!html) notFound();
  return <div className="inner-page"><PageIntro index={String(year)} title={`News · ${year}`} lede={`The complete public news record for ${year}.`} media={<img src="/design/card-news.webp" alt="News and research updates" loading="eager" />} /><SourceArticle item={homepage} html={html} /></div>;
}
