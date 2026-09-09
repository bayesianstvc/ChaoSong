"use client";

/* eslint-disable @next/next/no-img-element */
import { useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import type { SiteSettings } from "@/lib/cms";
import { safeHomepageHtmlUrl, siteAssetUrl } from "@/lib/site-settings";

type NetworkInformation = EventTarget & { saveData?: boolean; effectiveType?: string };

function motionSnapshot() {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !connection?.saveData && !/(?:slow-2g|2g)/.test(connection?.effectiveType ?? "");
}
function subscribeMotion(update: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  query.addEventListener("change", update);
  connection?.addEventListener("change", update);
  return () => { query.removeEventListener("change", update); connection?.removeEventListener("change", update); };
}
const serverMotionSnapshot = () => false;

export function HomeBackground({ settings }: { settings: SiteSettings }) {
  const motionAllowed = useSyncExternalStore(subscribeMotion, motionSnapshot, serverMotionSnapshot);
  const source = siteAssetUrl(settings.homeBackgroundAssetId, settings.homeBackgroundUrl);
  const poster = siteAssetUrl(
    settings.homeBackgroundPosterAssetId,
    settings.homeBackgroundPosterUrl || settings.homeHeroUrl,
  );
  const htmlSource = safeHomepageHtmlUrl(settings.homeBackgroundHtmlUrl);

  if (settings.homeBackgroundMode === "paper") return null;
  const style = {
    "--home-bg-opacity": settings.homeBackgroundOpacity,
    "--home-bg-fit": settings.homeBackgroundFit,
    "--home-bg-position": settings.homeBackgroundPosition,
  } as CSSProperties;

  return <div className="home-background" data-mode={settings.homeBackgroundMode} style={style} aria-hidden="true">
    {poster ? <img className="home-background-poster" src={poster} alt="" width="1600" height="900" loading="lazy" decoding="async" /> : null}
    {settings.homeBackgroundMode === "image" && source ? <img className="home-background-media" src={source} alt="" width="1600" height="900" loading="lazy" decoding="async" /> : null}
    {settings.homeBackgroundMode === "video" && source && motionAllowed ? <video className="home-background-media" src={source} poster={poster || undefined} muted autoPlay loop playsInline preload="metadata" /> : null}
    {settings.homeBackgroundMode === "html" && htmlSource && motionAllowed ? <iframe className="home-background-media" src={htmlSource} title="Decorative homepage background" sandbox="allow-scripts" loading="lazy" tabIndex={-1} /> : null}
    <span className="home-background-wash" />
  </div>;
}
