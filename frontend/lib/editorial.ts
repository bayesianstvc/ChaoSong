export type EditorialType = "news" | "publication" | "journal" | "research" | "resource" | "page";

export type EditorialEntry = {
  sourcePath: string;
  type: EditorialType;
  slug: string;
  title: string;
  summary: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  date: string | null;
  updated: string | null;
  language: "en" | "zh";
  href: string | null;
  journal: string | null;
  doi: string | null;
  draft: boolean;
  featured: boolean;
  body: string;
  html: string;
};

export type SearchRecord = {
  title: string;
  summary: string;
  body: string;
  href: string;
  type: string;
  language: "en" | "zh";
  date: string | null;
};

