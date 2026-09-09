import { ManagedEntryPage } from "@/components/managed-entry-page";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function GenericPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const corePages: Record<string, string> = { home: "/", about: "/about", news: "/news", publications: "/publications", resources: "/resources", research: "/research", bstvc: "/bstvc", journal: "/blogs" }; if (corePages[slug]) redirect(corePages[slug]); return <ManagedEntryPage type="page" slug={slug} />; }
