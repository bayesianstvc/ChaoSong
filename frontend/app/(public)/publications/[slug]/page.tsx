import type { Metadata } from "next";
import { ManagedEntryPage } from "@/components/managed-entry-page";
import { getPublishedEntryOrFallback } from "@/lib/cms";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const decoded = decodeURIComponent(slug); const entry = await getPublishedEntryOrFallback("publication", decoded);
  return { title: `Chao Song | ${entry?.title ?? "Publication"}`, description: entry?.seoDescription ?? entry?.summary, alternates: { canonical: `/publications/${decoded}` } };
}
export default async function PublicationArticle({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <ManagedEntryPage type="publication" slug={slug} />; }
