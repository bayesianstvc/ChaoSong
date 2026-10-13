import { publicPageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import { MigratedPage } from "@/components/migrated-page";
import { BstvcBrandMedia } from "@/components/bstvc-brand-media";

export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata({ type: "page", slug: "bstvc", path: "/bstvc", title: "BSTVC", description: "Bayesian Spatiotemporally Varying Coefficients modeling." });
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
      introMedia={<BstvcBrandMedia />}
    />
  );
}
