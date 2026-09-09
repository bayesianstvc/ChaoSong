/* Extracted reference imagery and the original portrait retain their source dimensions. */
/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { FullPageLink as Link } from "@/components/full-page-link";
import {
  ArrowDown,
  ArrowRight,
  Code,
  GlobeHemisphereWest,
  Heart,
  Stack,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { getHomepageUpdates, getPublishedEntryOrFallback, getSiteSettings, type SiteSettings } from "@/lib/cms";
import { formatDate } from "@/lib/content";
import { HomeBackground } from "@/components/home-background";
import { siteAssetUrl } from "@/lib/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const [entry, settings] = await Promise.all([
    getPublishedEntryOrFallback("page", "home"),
    getSiteSettings(),
  ]);
  return {
    title: settings.browserTitle,
    description: entry && "seoDescription" in entry
      ? entry.seoDescription ?? entry.summary
      : entry?.summary ?? settings.siteDescription,
    alternates: { canonical: "/" },
  };
}

function homepageCards(settings: SiteSettings) {
  return [
    { title: settings.homeCard1Title, description: settings.homeCard1Description, href: settings.homeCard1Href, action: settings.homeCard1Action, image: siteAssetUrl(settings.homeCard1ImageAssetId, settings.homeCard1ImageUrl), accent: "violet" },
    { title: settings.homeCard2Title, description: settings.homeCard2Description, href: settings.homeCard2Href, action: settings.homeCard2Action, image: siteAssetUrl(settings.homeCard2ImageAssetId, settings.homeCard2ImageUrl), accent: "blue" },
    { title: settings.homeCard3Title, description: settings.homeCard3Description, href: settings.homeCard3Href, action: settings.homeCard3Action, image: siteAssetUrl(settings.homeCard3ImageAssetId, settings.homeCard3ImageUrl), accent: "teal" },
    { title: settings.homeCard4Title, description: settings.homeCard4Description, href: settings.homeCard4Href, action: settings.homeCard4Action, image: siteAssetUrl(settings.homeCard4ImageAssetId, settings.homeCard4ImageUrl), accent: "orange" },
    { title: settings.homeCard5Title, description: settings.homeCard5Description, href: settings.homeCard5Href, action: settings.homeCard5Action, image: siteAssetUrl(settings.homeCard5ImageAssetId, settings.homeCard5ImageUrl), accent: "rose" },
  ] as const;
}

function homepagePrinciples(settings: SiteSettings) {
  return [
    { title: settings.homePrinciple1Title, description: settings.homePrinciple1Description, Icon: GlobeHemisphereWest },
    { title: settings.homePrinciple2Title, description: settings.homePrinciple2Description, Icon: Stack },
    { title: settings.homePrinciple3Title, description: settings.homePrinciple3Description, Icon: Code },
    { title: settings.homePrinciple4Title, description: settings.homePrinciple4Description, Icon: UsersThree },
    { title: settings.homePrinciple5Title, description: settings.homePrinciple5Description, Icon: Heart },
  ] as const;
}

export default async function Home() {
  const [homepage, settings, updates] = await Promise.all([
    getPublishedEntryOrFallback("page", "home"),
    getSiteSettings(),
    getHomepageUpdates(6),
  ]);
  const featureCards = homepageCards(settings);
  const principles = homepagePrinciples(settings);
  const profileImage = siteAssetUrl(settings.profileImageAssetId, settings.profileImageUrl);
  const heroImage = siteAssetUrl(settings.homeHeroAssetId, settings.homeHeroUrl);
  return (
    <div className="paper-home" style={{ "--home-brand-primary": settings.brandPrimary, "--home-brand-secondary": settings.brandSecondary } as CSSProperties}>
      <HomeBackground settings={settings} />
      <section className="landing-hero">
        <div className="hero-copy-final">
          <p className="hero-kicker">{settings.homeKicker}</p>
          <h1>{settings.homeTitle || homepage?.title || "Modeling where health happens."}</h1>
          <img className="hero-accent" src="/design/hero-accent.webp" alt="" aria-hidden="true" width="118" height="6" decoding="async" />
          <p className="hero-summary">
            {settings.homeIntro || homepage?.summary || "I develop Bayesian spatiotemporal models and open-source software to understand the distribution and dynamics of health outcomes across space and time."}
          </p>
          <div className="profile-chip">
            <img
              src={profileImage}
              alt={settings.profileImageAlt}
              width="64"
              height="64"
              decoding="async"
            />
            <span>
              <strong>{settings.profileName}</strong>
              {settings.profileRole}
            </span>
          </div>
          <div className="hero-actions-final">
            <Link href={settings.homePrimaryHref} className="button-dark">
              {settings.homePrimaryLabel} <ArrowRight size={17} weight="bold" aria-hidden="true" />
            </Link>
            <Link href={settings.homeSecondaryHref} className="button-paper">
              {settings.homeSecondaryLabel} <ArrowDown size={16} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </div>
        <figure className="hero-visual-final">
          <img
            src={heroImage}
            alt={settings.homeHeroAlt}
            width="1200"
            height="720"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </figure>
      </section>

      {updates.length ? <section className="home-updates" aria-labelledby="home-updates-title">
        <div className="home-updates-heading"><h2 id="home-updates-title">{settings.homeUpdatesTitle}</h2><Link href={settings.homeUpdatesHref}>{settings.homeUpdatesLabel} <ArrowRight size={14} weight="bold" /></Link></div>
        <div className="home-updates-rail">
          {updates.map((entry) => <Link href={entry.href} key={`${entry.section}:${entry.slug}`}>
            <time>{formatDate(entry.date ?? entry.updated)}</time>
            <span>{entry.section}</span>
            <strong>{entry.title}</strong>
          </Link>)}
        </div>
      </section> : null}

      <section className="feature-grid-final" aria-label="Explore the website">
        {featureCards.map((card) => (
          <Link
            href={card.href}
            className={`feature-card-final accent-${card.accent}`}
            key={card.title}
          >
            <div>
              <h2>{card.title}</h2>
              <p>{card.description}</p>
            </div>
            <img src={card.image} alt="" aria-hidden="true" width="600" height="400" loading="lazy" decoding="async" />
            <span>
              {card.action} <ArrowRight size={15} weight="bold" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </section>

      <section className="principles-final" aria-label="Research values">
        {principles.map(({ title, description, Icon }) => (
          <div key={title}>
            <Icon size={42} weight="light" aria-hidden="true" />
            <span>
              <strong>{title}</strong>
              {description}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
