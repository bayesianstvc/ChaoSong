import { ManagedEntryPage } from "@/components/managed-entry-page";
import { seedCmsIfEmpty } from "@/lib/cms";
export const dynamic = "force-dynamic";
export default async function ResourceArticle({ params }: { params: Promise<{ slug: string }> }) { await seedCmsIfEmpty(); const { slug } = await params; return <ManagedEntryPage type="resource" slug={slug} />; }
