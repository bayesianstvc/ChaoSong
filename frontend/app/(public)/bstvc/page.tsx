import type { Metadata } from "next";
import { MigratedPage } from "@/components/migrated-page";
import { getPublishedEntryOrFallback } from "@/lib/cms";

export async function generateMetadata(): Promise<Metadata> {
  const entry = await getPublishedEntryOrFallback("page", "bstvc");
  return {
    title: "Chao Song | Home",
    description: entry && "seoDescription" in entry
      ? entry.seoDescription ?? entry.summary
      : entry?.summary ?? "Bayesian Spatiotemporally Varying Coefficients modeling.",
    alternates: { canonical: "/bstvc" },
  };
}

export default function BstvcPage() {
  return (
    <MigratedPage
      slug="bayesian-stvc"
      index="02"
      title="Bayesian Spatiotemporally Varying Coefficients"
      lede="A unified full-map approach to detecting spatiotemporal heterogeneity of variable relationships."
      managedSlug="bstvc"
      introAction={<a className="page-intro-primary-link" href="https://bayesianstvc.github.io/" target="_blank" rel="noreferrer">Visit the official BSTVC website ↗</a>}
      introMedia={<iframe className="bstvc-motion-logo" src="/bstvc-logo-motion.html?motion=force&v=52" title="Animated BSTVC logo" loading="eager" tabIndex={-1} />}
    />
  );
}
