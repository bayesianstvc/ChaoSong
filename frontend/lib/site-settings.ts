export const defaultSiteSettings = {
  browserTitle: "Chao Song | Home",
  siteDescription: "Health and medical geography, spatial health statistics, Bayesian spatiotemporal modeling, and BSTVC series models.",
  siteName: "Chao Song 宋超",
  headerTagline: "Researcher in Health, Geography & Bayesian Spatiotemporal Modeling",
  headerLogoAssetId: "",
  headerLogoUrl: "/design/brand-mark.webp",
  faviconAssetId: "",
  faviconUrl: "/favicon.png",
  faviconVersion: "1",
  defaultOgAssetId: "",
  defaultOgUrl: "/og.png",
  homeKicker: "Health · Geography · Data · Time",
  homeTitle: "",
  homeIntro: "",
  homeHeroAssetId: "",
  homeHeroUrl: "/design/hero-atlas.webp",
  homeHeroAlt: "Paper-cut world map surrounding an abstract spatiotemporal modeling mark",
  profileName: "Chao Song / 宋超",
  profileRole: "Health & Medical Geography",
  profileImageAssetId: "",
  profileImageUrl: "/profile/chao-song-2025.jpg",
  profileImageAlt: "Portrait of Chao Song",
  homePrimaryLabel: "Explore My Work",
  homePrimaryHref: "/research",
  homeSecondaryLabel: "View CV",
  homeSecondaryHref: "/about",
  homeUpdatesTitle: "Latest News",
  homeUpdatesLabel: "View all news",
  homeUpdatesHref: "/news",
  homeBackgroundMode: "paper",
  homeBackgroundAssetId: "",
  homeBackgroundUrl: "",
  homeBackgroundPosterAssetId: "",
  homeBackgroundPosterUrl: "",
  homeBackgroundHtmlUrl: "",
  homeBackgroundOpacity: "0.22",
  homeBackgroundFit: "cover",
  homeBackgroundPosition: "center",
  brandPrimary: "#0c2d49",
  brandSecondary: "#4a73e7",
  homeCard1Title: "BSTVC Ecosystem",
  homeCard1Description: "Open-source R tools and methods for Bayesian spatiotemporal modeling and spatial epidemiology.",
  homeCard1Href: "/bstvc",
  homeCard1Action: "Explore BSTVC",
  homeCard1ImageAssetId: "",
  homeCard1ImageUrl: "/design/card-bstvc.webp",
  homeCard2Title: "Research Areas",
  homeCard2Description: "Health geography, spatial epidemiology, Bayesian modeling, and uncertainty quantification.",
  homeCard2Href: "/research",
  homeCard2Action: "Learn More",
  homeCard2ImageAssetId: "",
  homeCard2ImageUrl: "/design/card-research.webp",
  homeCard3Title: "Publications",
  homeCard3Description: "Peer-reviewed methodological contributions, applications, and interdisciplinary collaborations.",
  homeCard3Href: "/publications",
  homeCard3Action: "View Publications",
  homeCard3ImageAssetId: "",
  homeCard3ImageUrl: "/design/card-publications.webp",
  homeCard4Title: "Resources",
  homeCard4Description: "Research data, software, documentation, cases, and materials for learning and reuse.",
  homeCard4Href: "/resources",
  homeCard4Action: "Explore Resources",
  homeCard4ImageAssetId: "",
  homeCard4ImageUrl: "/design/card-resources.webp",
  homeCard5Title: "Blogs",
  homeCard5Description: "Long-form research notes, science communication, methods, and reflections.",
  homeCard5Href: "/blogs",
  homeCard5Action: "Read the Blog",
  homeCard5ImageAssetId: "",
  homeCard5ImageUrl: "/design/card-news.webp",
  homePrinciple1Title: "Global Perspective",
  homePrinciple1Description: "Understanding health across places and populations.",
  homePrinciple2Title: "Methodological Rigor",
  homePrinciple2Description: "Bayesian statistics for complex spatiotemporal data.",
  homePrinciple3Title: "Open Science",
  homePrinciple3Description: "Open-source tools for reproducible research.",
  homePrinciple4Title: "Interdisciplinary",
  homePrinciple4Description: "Bridging geography, statistics, computing, and health.",
  homePrinciple5Title: "Impact",
  homePrinciple5Description: "Turning data into insight for better health outcomes.",
  footerName: "Chao Song / 宋超",
  footerTagline: "Health & Medical Geography · Bayesian Spatiotemporal Modeling",
  footerNote: "Complete academic website · Updated 2026",
  institutionName: "West China School of Public Health / West China Fourth Hospital, Sichuan University",
  institutionUrl: "https://www.wcfh.com.cn/wsxs_szdw2_szdw/040013100000094.html",
  heoaUrl: "https://heoagroup.org/",
  scholarUrl: "https://scholar.google.com/citations?user=ooF-0YoAAAAJ&hl=zh-CN",
  orcidUrl: "https://orcid.org/0000-0003-2099-755X",
  researchGateUrl: "https://www.researchgate.net/profile/Chao-Song-19",
  githubUrl: "https://github.com/bayesianstvc",
  xUrl: "https://x.com/ChaoS29682541",
  bstvcWebsiteUrl: "https://bayesianstvc.github.io/",
  bstvcDesktopUrl: "https://bayesianstvc.github.io/BSTVC-Desktop/",
  bstvcGithubUrl: "https://github.com/bayesianstvc/BSTVC-R",
} as const satisfies Record<string, string>;

export type SiteSettings = { -readonly [Key in keyof typeof defaultSiteSettings]: string };
export type SiteSettingKey = keyof SiteSettings;

const assetPattern = /^media_[a-zA-Z0-9_-]+$/;
const urlKeys = new Set<SiteSettingKey>(
  (Object.keys(defaultSiteSettings) as SiteSettingKey[]).filter((key) => key.endsWith("Url") || key.endsWith("Href")),
);

function safeUrl(value: string, localOnly = false) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed.slice(0, 2000);
  if (trimmed.startsWith("#")) return trimmed.slice(0, 300);
  if (localOnly) return "";
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? trimmed.slice(0, 2000) : "";
  } catch {
    return "";
  }
}

export function normalizeSiteSettings(input: unknown): SiteSettings {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const normalized = { ...defaultSiteSettings } as SiteSettings;
  for (const key of Object.keys(defaultSiteSettings) as SiteSettingKey[]) {
    if (!(key in source)) continue;
    const fallback = defaultSiteSettings[key];
    const limit = key.includes("Description") || key === "homeIntro" || key === "siteDescription" ? 1200 : 300;
    normalized[key] = String(source[key] ?? "").trim().slice(0, limit) as never;
    if (!normalized[key] && fallback && !["homeTitle", "homeIntro", "homeBackgroundUrl", "homeBackgroundPosterUrl", "homeBackgroundHtmlUrl"].includes(key)) {
      normalized[key] = fallback as never;
    }
  }

  for (const key of urlKeys) normalized[key] = safeUrl(normalized[key], key === "homeBackgroundHtmlUrl") as never;
  for (const key of Object.keys(normalized).filter((key) => key.endsWith("AssetId")) as SiteSettingKey[]) {
    normalized[key] = assetPattern.test(normalized[key]) ? normalized[key] as never : "" as never;
  }
  normalized.homeBackgroundMode = (["paper", "image", "video", "html"].includes(normalized.homeBackgroundMode) ? normalized.homeBackgroundMode : "paper") as never;
  normalized.homeBackgroundFit = (["cover", "contain", "fill"].includes(normalized.homeBackgroundFit) ? normalized.homeBackgroundFit : "cover") as never;
  normalized.homeBackgroundPosition = (/^(?:center|top|bottom|left|right|\d{1,3}%\s+\d{1,3}%)$/.test(normalized.homeBackgroundPosition) ? normalized.homeBackgroundPosition : "center") as never;
  normalized.homeBackgroundOpacity = String(Math.min(1, Math.max(0, Number(normalized.homeBackgroundOpacity) || 0))) as never;
  normalized.brandPrimary = (/^#[0-9a-f]{6}$/i.test(normalized.brandPrimary) ? normalized.brandPrimary : defaultSiteSettings.brandPrimary) as never;
  normalized.brandSecondary = (/^#[0-9a-f]{6}$/i.test(normalized.brandSecondary) ? normalized.brandSecondary : defaultSiteSettings.brandSecondary) as never;
  normalized.faviconVersion = normalized.faviconVersion.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) as never;
  if (normalized.homeUpdatesTitle === "Latest Updates") normalized.homeUpdatesTitle = "Latest News";
  if (normalized.homeUpdatesLabel === "View all updates") normalized.homeUpdatesLabel = "View all news";
  if (normalized.homeUpdatesHref === "/updates") normalized.homeUpdatesHref = "/news";
  if (/^News\s*(?:&|and)\s*Blogs$/i.test(normalized.homeCard5Title)) {
    normalized.homeCard5Title = "Blogs";
    normalized.homeCard5Description = defaultSiteSettings.homeCard5Description;
    normalized.homeCard5Href = "/blogs";
    normalized.homeCard5Action = "Read the Blog";
  }
  if (/original archive|online-managed/i.test(normalized.footerNote)) normalized.footerNote = defaultSiteSettings.footerNote;
  if (normalized.bstvcWebsiteUrl === "https://bayesianstvc.github.io/BSTVC-Desktop/") normalized.bstvcWebsiteUrl = defaultSiteSettings.bstvcWebsiteUrl;
  return normalized;
}

export function siteAssetUrl(assetId: string, fallbackUrl: string) {
  return assetPattern.test(assetId) ? `/cms-media/assets/${encodeURIComponent(assetId)}` : safeUrl(fallbackUrl);
}

export function safeHomepageHtmlUrl(value: string) {
  const url = safeUrl(value, true);
  return /\.html?(?:[?#].*)?$/i.test(url) ? url : "";
}
