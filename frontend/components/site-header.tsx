/* eslint-disable @next/next/no-img-element */
import { FullPageLink as Link } from "./full-page-link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { SiteNav } from "@/components/site-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteLanguageMenu } from "@/components/site-language-menu";
import { getSiteSettings } from "@/lib/cms";
import { siteAssetUrl } from "@/lib/site-settings";

export async function SiteHeader() {
  const settings = await getSiteSettings();
  return (
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label="Chao Song homepage">
        <img src={siteAssetUrl(settings.headerLogoAssetId, settings.headerLogoUrl)} alt="" aria-hidden="true" width="62" height="72" decoding="async" />
        <span>
          <strong>{settings.siteName}</strong>
          <small>{settings.headerTagline}</small>
        </span>
      </Link>
      <SiteNav />
      <div className="header-tools">
        <Link href="/search" aria-label="Search the website" title="Search the whole website" className="header-icon-button">
          <MagnifyingGlass size={18} weight="regular" aria-hidden="true" />
        </Link>
        <SiteLanguageMenu />
        <ThemeToggle />
      </div>
    </header>
  );
}
