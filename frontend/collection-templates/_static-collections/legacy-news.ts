import { extractHtmlSection, getPage } from '@/lib/content';
import { extractNewsYearHtml, extractNewsYears } from '@/lib/news-archive';

/** Explicitly retained historical archive. It never supplies current CMS article body. */
export function getLegacyNewsArchive() {
  const homepage = getPage('main-page');
  const html = homepage
    ? extractHtmlSection(homepage.contentHtml, 'News (2016-2025)', 'Related People') ?? ''
    : '';
  const years = extractNewsYears(html).filter((year) => Boolean(extractNewsYearHtml(html, year)));
  return { homepage, html, years };
}
