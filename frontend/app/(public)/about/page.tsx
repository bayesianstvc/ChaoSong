/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { MigratedPage } from "@/components/migrated-page";
import { getPublishedEntryOrFallback, getSiteSettings } from "@/lib/cms";
import { PrintCvButton } from "@/components/print-cv-button";
import { siteAssetUrl } from "@/lib/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const entry = await getPublishedEntryOrFallback("page", "about");
  return {
    title: "Chao Song | Home",
    description: entry && "seoDescription" in entry ? entry.seoDescription ?? entry.summary : entry?.summary,
  };
}

export default async function AboutPage() {
  const settings = await getSiteSettings();
  return (
    <MigratedPage
      slug="aboutme"
      index="07"
      title="About Chao Song"
      lede="Academic experience, research interests, professional links, and collaborators."
      managedSlug="about"
      introMedia={<img className="profile-intro-image" src={siteAssetUrl(settings.profileImageAssetId, settings.profileImageUrl)} alt={settings.profileImageAlt} loading="eager" decoding="async" />}
      beforeContent={<>
        <section className="about-actions"><div><p>Curriculum vitae</p><h2>A concise, printable academic profile</h2></div><PrintCvButton /></section>
        <section className="milestone-timeline" aria-label="Selected academic milestones">
          <article><time>Research foundation</time><h2>Health and medical geography</h2><p>Building a sustained programme around spatial health, population, environment, and place.</p></article>
          <article><time>Method development</time><h2>BSTVC model family</h2><p>Connecting Bayesian spatiotemporal inference, interpretation, software, and applied research.</p></article>
          <article><time>Open research</time><h2>Software, teaching, and reproducibility</h2><p>Turning methodological work into tools, documentation, cases, and learning resources.</p></article>
          <article><time>Current direction</time><h2>Interpretable GeoAI and decision support</h2><p>Advancing rigorous, explainable evidence for public-health action and equitable planning.</p></article>
        </section>
        <aside className="collaboration-entry"><div><p>Collaboration</p><h2>Work together across methods, data, and public-health questions.</h2></div><a href="mailto:chaosong@scu.edu.cn">Start a conversation ↗</a></aside>
      </>}
    />
  );
}
