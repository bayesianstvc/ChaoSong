import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";
import { SearchClient } from "@/components/search-client";
import { buildDynamicSearchIndex } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Chao Song | Home",
  description: "Search Chao Song's research, publications, news, BSTVC resources, and bilingual journal archive.",
  robots: { index: false, follow: true },
};

export default async function SearchPage() {
  const records = await buildDynamicSearchIndex();
  return (
    <div className="inner-page">
      <PageIntro
        index="08"
        title="Search"
        lede="Search across current MDX content and the complete migrated English and Chinese archive."
      />
      <SearchClient records={records} />
    </div>
  );
}
