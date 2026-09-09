import { notFound } from "next/navigation";
import { PageIntro } from "@/components/page-intro";
import { ManagedContent } from "@/components/managed-content";
import { getPublishedEntry } from "@/lib/cms";

export const dynamic = "force-dynamic";

export default async function ManagedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = await getPublishedEntry("page", decodeURIComponent(slug));
  if (!entry) notFound();
  return (
    <div className="inner-page">
      <PageIntro index="Page" title={entry.title} lede={entry.summary} />
      <ManagedContent entry={entry} />
    </div>
  );
}
