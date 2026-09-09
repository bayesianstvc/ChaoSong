/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { MigratedPage } from "@/components/migrated-page";
import { getPublishedEntryOrFallback } from "@/lib/cms";

export async function generateMetadata(): Promise<Metadata> {
  const entry = await getPublishedEntryOrFallback("page", "research");
  return {
    title: "Chao Song | Home",
    description: entry && "seoDescription" in entry
      ? entry.seoDescription ?? entry.summary
      : entry?.summary ?? "Research in health and medical geography and Bayesian spatiotemporal statistics.",
    alternates: { canonical: "/research" },
  };
}

export default function ResearchPage() {
  return (
    <MigratedPage
      slug="research"
      index="01"
      title="Research"
      lede="GIScience, spatiotemporal statistics, Bayesian modeling, environmental health, spatial epidemiology, and public health."
      managedSlug="research"
      collectionType="research"
      introMedia={<img src="/design/card-research.webp" alt="Research areas visual" loading="eager" decoding="async" />}
    />
  );
}
