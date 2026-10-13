import { MigratedPage } from "@/components/migrated-page";
import { BstvcBrandMedia } from "@/components/bstvc-brand-media";


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
