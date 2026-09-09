/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";
import { SourceArticle } from "@/components/source-article";
import { getPage } from "@/lib/content";
import { getPublishedEntryOrFallback } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Chao Song | Publications",
  description: "The complete peer-reviewed publication record of Chao Song.",
  alternates: { canonical: "/publications" },
  openGraph: { images: ["/og.png"] },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default async function PublicationsPage() {
  const source = getPage("publications");
  const page = await getPublishedEntryOrFallback("page", "publications");
  if (!source) return null;
  const bodyHtml = page && !page.sourcePath.startsWith("builtin:") ? page.html : source.contentHtml;
  return (
    <div className="inner-page">
      <PageIntro
        index="03"
        title={page?.title ?? "Publications"}
        lede={page?.summary ?? "Complete peer-reviewed publications, methodological contributions, and applied studies."}
        media={<img src="/design/card-publications.webp" alt="Publications visual" loading="eager" decoding="async" />}
      />
      {bodyHtml ? <SourceArticle item={source} html={bodyHtml} /> : null}
    </div>
  );
}
