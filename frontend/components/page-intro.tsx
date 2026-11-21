import { splitBilingualHeading } from "@/lib/public-article-presentation";

export function PageIntro({
  index,
  title,
  titleLanguage,
  lede,
  media,
  action,
}: {
  index: string;
  title: string;
  titleLanguage?: "en" | "zh";
  lede?: string;
  media?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const bilingual = titleLanguage === "en" ? splitBilingualHeading(title) : null;
  return (
    <>
    <link rel="preload" as="image" href="/design/paper-texture.webp" fetchPriority="high" />
    <header className="page-intro">
      <p className="section-index" aria-hidden="true">
        {index}
      </p>
      <div>
        <h1 lang={titleLanguage === "zh" ? titleLanguage : undefined}>{bilingual ? <><span lang={bilingual.beforeLang}>{bilingual.before}</span>{bilingual.divider}<span lang={bilingual.afterLang}>{bilingual.after}</span></> : title}</h1>
        {lede ? <p>{lede}</p> : null}
        {action ? <div className="page-intro-action">{action}</div> : null}
      </div>
      {media ? <div className="page-intro-media">{media}</div> : null}
    </header>
    </>
  );
}
