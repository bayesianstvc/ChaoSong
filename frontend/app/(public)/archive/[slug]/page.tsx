import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/page-intro";
import { SourceArticle } from "@/components/source-article";
import { getPage, pages } from "@/lib/content";

export function generateStaticParams() {
  return pages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Chao Song | Home" };
}

export default async function ArchiveEntry({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getPage(decodeURIComponent(slug));
  if (!page) notFound();
  return (
    <div className="inner-page">
      <PageIntro index="Archive" title={page.title} />
      <SourceArticle item={page} />
    </div>
  );
}
