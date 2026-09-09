/* eslint-disable @next/next/no-img-element */
import { FullPageLink as Link } from "./full-page-link";
import { getSiteSettings, getSiteLastUpdated } from "@/lib/cms";
import { siteAssetUrl } from "@/lib/site-settings";

export async function SiteFooter() {
  const settings = await getSiteSettings();
  const updated = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "2-digit", timeZone: "Asia/Shanghai" }).format(await getSiteLastUpdated());
  const footerNote = `Health across place and time · Updated ${updated}`;
  return (
    <footer className="site-footer">
      <div className="footer-primary">
        <div className="footer-identity">
          <img src={siteAssetUrl(settings.profileImageAssetId, settings.profileImageUrl)} alt={settings.profileImageAlt} width="88" height="88" loading="lazy" decoding="async" />
          <div>
            <p className="footer-name">{settings.footerName}</p>
            <div className="footer-identity-lines">
              <p className="footer-role">PI, HEOA—West China Health &amp; Medical Geography Group</p>
              <p className="footer-role">Developer of <a href={settings.bstvcWebsiteUrl} target="_blank" rel="noreferrer">BSTVC</a> theories and products.</p>
              <a href={settings.institutionUrl} target="_blank" rel="noreferrer">
              {settings.institutionName}
              </a>
            </div>
          </div>
        </div>
        <nav className="footer-link-groups" aria-label="Academic profiles and site links">
          <section>
            <h2>Academic profiles</h2>
            <a href={settings.scholarUrl} target="_blank" rel="noreferrer">Google Scholar</a>
            <a href={settings.orcidUrl} target="_blank" rel="noreferrer">ORCID</a>
            <a href={settings.researchGateUrl} target="_blank" rel="noreferrer">ResearchGate</a>
            <a href={settings.institutionUrl} target="_blank" rel="noreferrer">中文官网</a>
          </section>
          <section>
            <h2>Connect</h2>
            <a href={settings.githubUrl} target="_blank" rel="noreferrer">GitHub</a>
            <a href={settings.xUrl} target="_blank" rel="noreferrer">X / Twitter</a>
            <Link href="/about">About &amp; CV</Link>
            <a href="mailto:chaosong@scu.edu.cn">Email Chao Song</a>
          </section>
          <section>
            <h2>BSTVC ecosystem</h2>
            <a href={settings.bstvcWebsiteUrl} target="_blank" rel="noreferrer">BSTVC series website</a>
            <a href={settings.bstvcDesktopUrl} target="_blank" rel="noreferrer">BSTVC-Desktop</a>
            <a href={settings.bstvcGithubUrl} target="_blank" rel="noreferrer">BSTVC R package</a>
            <Link href="/bstvc">Methods &amp; software</Link>
          </section>
          <section>
            <h2>Explore</h2>
            <a href={settings.heoaUrl} target="_blank" rel="noreferrer">HEOA Think Tank</a>
            <Link href="/research">Research</Link>
            <Link href="/publications">Publications</Link>
            <Link href="/blogs">Blogs</Link>
            <Link href="/search">Search</Link>
          </section>
        </nav>
      </div>
      <div className="footer-bottom">
        <p className="footer-note">{footerNote}</p>
        <div><Link href="/studio">Owner Studio</Link></div>
      </div>
    </footer>
  );
}
