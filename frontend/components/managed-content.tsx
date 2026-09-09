import type { EditorialEntry } from "@/lib/editorial";
import { OriginalContentToc } from "@/components/original-content-toc";

export function ManagedContent({
  entry,
  label = "Page contents",
}: {
  entry: EditorialEntry;
  label?: string;
}) {
  return (
    <section className="managed-content" aria-label={label}>
      <OriginalContentToc html={entry.html} language={entry.language} />
    </section>
  );
}
