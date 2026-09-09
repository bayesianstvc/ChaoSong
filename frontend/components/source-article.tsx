import type { ContentItem } from "@/lib/content";
import { OriginalContentToc } from "@/components/original-content-toc";

export function SourceArticle({ item, html }: { item: ContentItem; html?: string }) {
  return (
    <article className="source-article">
      <OriginalContentToc html={html ?? item.contentHtml} language={item.language} />
    </article>
  );
}
