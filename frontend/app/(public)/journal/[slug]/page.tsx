import { redirect } from "next/navigation";

export default async function LegacyJournalArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/blogs/${encodeURIComponent(decodeURIComponent(slug))}`);
}
