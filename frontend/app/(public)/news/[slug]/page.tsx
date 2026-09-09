import { ManagedEntryPage } from "@/components/managed-entry-page";
export const dynamic = "force-dynamic";
export default async function NewsArticle({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <ManagedEntryPage type="news" slug={slug} />; }
