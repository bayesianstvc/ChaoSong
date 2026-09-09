export type NewsItem = {
  slug: string;
  title: string;
  summary: string;
  date: string | null;
  updated?: string | null;
  dateLabel: string;
  newsKind: 'news' | 'publication';
};
export type BlogItem = {
  slug: string;
  title: string;
  date: string | null;
  dateLabel: string;
  language: string;
  managed: boolean;
};
export type ResourceItem = {
  slug: string;
  title: string;
  summary: string;
  date?: string | null;
  updated?: string | null;
};
