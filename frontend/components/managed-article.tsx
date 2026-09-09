import type { EditorialEntry } from "@/lib/editorial";
import { formatDate } from "@/lib/content";
import { OriginalContentToc } from "@/components/original-content-toc";
import { mergeCompleteHtml, usesUnifiedFinalContent } from "@/lib/content-merge";

export function ManagedArticle({ entry }: { entry: EditorialEntry & { originalHtml?: string } }) {
  const finalHtml = usesUnifiedFinalContent(entry.type, entry.slug)
    ? mergeCompleteHtml(entry.html, entry.originalHtml ?? "")
    : entry.html;
  return (
    <article className="source-article editorial-article">
      <OriginalContentToc html={finalHtml} language={entry.language} railFooter={<dl><div><dt>Published</dt><dd>{formatDate(entry.date)}</dd></div><div><dt>Updated</dt><dd>{formatDate(entry.updated)}</dd></div></dl>} />
    </article>
  );
}
