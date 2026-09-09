import type { Metadata } from "next";
import { FullPageLink as Link } from "@/components/full-page-link";
import { PageIntro } from "@/components/page-intro";
import { pages } from "@/lib/content";

export const metadata: Metadata = { title: "Chao Song | Home" };

export default function ArchivePage() {
  return (
    <div className="inner-page">
      <PageIntro
        index="A"
        title="Source Archive"
        lede="A completeness layer preserving every public WordPress page in its original order and language."
      />
      <div className="archive-list">
        {pages.map((page) => (
          <Link href={`/archive/${encodeURIComponent(page.slug)}`} key={page.slug}>
            <h2>{page.title}</h2>
            <p>
              {page.plainTextLength.toLocaleString()} text characters · {page.imageCount} images · {page.linkCount} links
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
