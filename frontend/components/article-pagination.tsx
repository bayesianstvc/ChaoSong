import Link from "next/link";
import { formatDate } from "@/lib/content";

export type ArticleNavigationItem = {
  slug: string;
  href: string;
  title: string;
  date: string | null;
};

export function ArticlePagination({ previous, next }: { previous: ArticleNavigationItem | null; next: ArticleNavigationItem | null }) {
  if (!previous && !next) return null;
  return <nav className="article-pagination" aria-label="Article navigation">
    {previous ? <Link href={previous.href} className="article-pagination-link article-pagination-previous"><span>Previous article · 上一篇</span><strong>{previous.title}</strong><time>{formatDate(previous.date)}</time></Link> : <span aria-hidden="true" />}
    {next ? <Link href={next.href} className="article-pagination-link article-pagination-next"><span>Next article · 下一篇</span><strong>{next.title}</strong><time>{formatDate(next.date)}</time></Link> : <span aria-hidden="true" />}
  </nav>;
}
