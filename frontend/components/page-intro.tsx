export function PageIntro({
  index,
  title,
  lede,
  media,
  action,
}: {
  index: string;
  title: string;
  lede?: string;
  media?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-intro">
      <p className="section-index" aria-hidden="true">
        {index}
      </p>
      <div>
        <h1>{title}</h1>
        {lede ? <p>{lede}</p> : null}
        {action ? <div className="page-intro-action">{action}</div> : null}
      </div>
      {media ? <div className="page-intro-media">{media}</div> : null}
    </header>
  );
}
