import type { Metadata } from "next";
import "katex/dist/katex.min.css";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import { ContentGalleryController } from "@/components/content-gallery-controller";
import { getSiteSettings } from "@/lib/cms";
import { siteAssetUrl } from "@/lib/site-settings";

async function requestOrigin() { return "https://chaosong.blog/"; }

export async function generateMetadata(): Promise<Metadata> {
  const [origin, settings] = await Promise.all([requestOrigin(), getSiteSettings()]);
  const favicon = siteAssetUrl(settings.faviconAssetId, settings.faviconUrl);
  const profile = siteAssetUrl(settings.profileImageAssetId, settings.profileImageUrl);
  const socialImage = siteAssetUrl(settings.defaultOgAssetId, settings.defaultOgUrl);
  return {
    metadataBase: new URL(origin), title: { absolute: settings.browserTitle }, description: settings.siteDescription,
    applicationName: settings.browserTitle, authors: [{ name: "Chao Song" }], creator: "Chao Song",
    keywords: ["health geography", "medical geography", "spatial epidemiology", "Bayesian spatiotemporal modeling", "BSTVC", "GeoAI", "宋超"],
    icons: { icon: [{ url: `${favicon}?v=${encodeURIComponent(settings.faviconVersion)}`, type: "image/png" }], shortcut: `${favicon}?v=${encodeURIComponent(settings.faviconVersion)}`, apple: profile },
    openGraph: { type: "website", url: origin, siteName: settings.siteName, title: settings.siteName, description: settings.siteDescription, locale: "en_US", alternateLocale: ["zh_CN"], images: [{ url: socialImage, alt: `${settings.siteName} — ${settings.footerTagline}` }] },
    twitter: { card: "summary_large_image", title: settings.siteName, description: settings.siteDescription, images: [socialImage] },
    robots: { index: true, follow: true },
  };
}

export default async function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [origin, settings] = await Promise.all([requestOrigin(), getSiteSettings()]);
  const structuredData = {
    "@context": "https://schema.org", "@type": "ProfilePage", url: origin, name: settings.siteName,
    mainEntity: {
      "@type": "Person", name: settings.profileName, alternateName: "宋超", url: origin,
      sameAs: [settings.scholarUrl, settings.orcidUrl, settings.githubUrl, settings.researchGateUrl, settings.xUrl, settings.institutionUrl].filter(Boolean),
      knowsAbout: ["Health and medical geography", "Spatial epidemiology", "Bayesian spatiotemporal modeling", "BSTVC"],
    },
  };
  return <>
    
    <ContentGalleryController />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <div className="site-frame"><SiteHeader /><main>{children}</main><SiteFooter /></div>
  </>;
}
