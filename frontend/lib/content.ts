import contentData from "@/data/migrated-content.json";

export type ContentItem = {
  id: number;
  type: "page" | "post";
  slug: string;
  title: string;
  date: string | null;
  modified: string | null;
  sourceUrl: string;
  language: "en" | "zh";
  headings: string[];
  contentHtml: string;
  excerptHtml: string;
  plainTextLength: number;
  imageCount: number;
  linkCount: number;
  imageSources: string[];
  externalLinks: string[];
};

export const pages = contentData.pages as ContentItem[];
export const posts = contentData.posts as ContentItem[];

export function getPage(slug: string) {
  return pages.find((page) => page.slug === slug);
}

export function getPost(slug: string) {
  return posts.find((post) => post.slug === slug);
}

export function firstLocalImage(renderedHtml = "") {
  const match = renderedHtml.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

export function extractHtmlSection(
  renderedHtml: string,
  startText: string,
  endText?: string,
) {
  const headingPattern = /<h[1-3]\b[^>]*>.*?<\/h[1-3]>/gis;
  const headings = [...renderedHtml.matchAll(headingPattern)];
  const start = headings.find((match) =>
    match[0].replace(/<[^>]+>/g, " ").includes(startText),
  );
  if (!start?.index) return renderedHtml;

  let endIndex = renderedHtml.length;
  if (endText) {
    const end = headings.find(
      (match) =>
        (match.index ?? 0) > (start.index ?? 0) &&
        match[0].replace(/<[^>]+>/g, " ").includes(endText),
    );
    if (end?.index) endIndex = end.index;
  }
  return renderedHtml.slice(start.index, endIndex);
}

export function formatDate(value: string | null) {
  if (!value) return "Undated";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

