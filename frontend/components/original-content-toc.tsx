"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

type TocItem = { id: string; label: string; level: 2 | 3; page: number };

const PAGE_BREAK_PATTERN = /<div\b[^>]*(?:data-page-break=["']true["']|class=["'][^"']*article-page-break[^"']*["'])[^>]*>[\s\S]*?<\/div>/gi;

function plainText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string, index: number) {
  const slug = plainText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `section-${slug || index + 1}`;
}

function decorateHeadings(html: string) {
  const items: TocItem[] = [];
  const seen = new Map<string, number>();
  const mediaOptimized = html.replace(/<img\b([^>]*)>/gi, (_match, attributes: string) => {
    const normalizedAttributes = attributes.replace(/\s*\/\s*$/, "");
    const loading = /\sloading=/i.test(normalizedAttributes) ? "" : ' loading="lazy"';
    const decoding = /\sdecoding=/i.test(normalizedAttributes) ? "" : ' decoding="async"';
    return `<img${normalizedAttributes}${loading}${decoding}>`;
  });
  const pages = mediaOptimized.split(PAGE_BREAK_PATTERN).map((pageHtml, page) => pageHtml.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_match, rawLevel: string, rawAttributes: string, content: string) => {
    const level = Number(rawLevel) as 2 | 3;
    const existingId = rawAttributes.match(/\sid=["']([^"']+)["']/i)?.[1];
    const base = existingId || slugify(content, items.length);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    const attributes = existingId ? rawAttributes.replace(/\sid=["'][^"']+["']/i, "") : rawAttributes;
    items.push({ id, label: plainText(content), level, page });
    return `<h${level}${attributes} id="${id}">${content}</h${level}>`;
  }));
  return { html: pages.join(""), items, pages };
}

export function OriginalContentToc({ html, language, railFooter }: { html: string; language?: "zh" | "en"; railFooter?: ReactNode }) {
  const prepared = useMemo(() => decorateHeadings(html), [html]);
  const [activeId, setActiveId] = useState(prepared.items[0]?.id ?? "");
  const [pageIndex, setPageIndex] = useState(0);
  const articleRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const hasExplicitPages = prepared.pages.length > 1;
  const safePageIndex = Math.min(pageIndex, Math.max(0, prepared.pages.length - 1));
  const isLongArticle = prepared.items.length >= 4 || plainText(prepared.html).length >= 5000;
  const activeIndex = Math.max(0, prepared.items.findIndex((item) => item.id === activeId));
  const currentPageItems = useMemo(() => prepared.items.filter((item) => item.page === safePageIndex), [safePageIndex, prepared]);

  function scrollArticleStart() {
    columnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goToSection(index: number) {
    const item = prepared.items[index];
    if (!item) return;
    setPageIndex(item.page);
    setActiveId(item.id);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      articleRef.current?.querySelector<HTMLElement>(`#${CSS.escape(item.id)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  function goToPage(nextPage: number) {
    const safePage = Math.max(0, Math.min(prepared.pages.length - 1, nextPage));
    setPageIndex(safePage);
    setActiveId(prepared.items.find((item) => item.page === safePage)?.id ?? "");
    window.requestAnimationFrame(scrollArticleStart);
  }

  useEffect(() => {
    const headings = currentPageItems
      .map((item) => articleRef.current?.querySelector<HTMLElement>(`#${CSS.escape(item.id)}`))
      .filter((item): item is HTMLElement => Boolean(item));
    if (!headings.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-18% 0px -68% 0px", threshold: [0, 1] },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [currentPageItems]);

  return (
    <div className="original-reading-layout">
      <nav className="original-toc" aria-label="Table of contents">
        <p>On this page</p>
        {prepared.items.length ? prepared.items.map((item, index) => (
          <a
            className={`${item.level === 3 ? "is-subsection" : ""} ${activeId === item.id ? "active" : ""} ${hasExplicitPages && item.page !== safePageIndex ? "is-other-page" : ""}`}
            href={`#${item.id}`}
            key={item.id}
            onClick={(event) => { event.preventDefault(); goToSection(index); }}
          >
            {item.label}
          </a>
        )) : <span className="original-toc-empty">Article</span>}
        {hasExplicitPages ? <div className="long-article-pager" aria-label="Article page navigation">
          <span>Pages · {safePageIndex + 1}/{prepared.pages.length}</span>
          <div><button type="button" disabled={safePageIndex === 0} onClick={() => goToPage(safePageIndex - 1)}>Previous</button><button type="button" disabled={safePageIndex >= prepared.pages.length - 1} onClick={() => goToPage(safePageIndex + 1)}>Next</button></div>
        </div> : isLongArticle && prepared.items.length ? <div className="long-article-pager" aria-label="Long article section navigation">
          <span>Sections · {activeIndex + 1}/{prepared.items.length}</span>
          <div><button type="button" disabled={activeIndex === 0} onClick={() => goToSection(activeIndex - 1)}>Previous</button><button type="button" disabled={activeIndex >= prepared.items.length - 1} onClick={() => goToSection(activeIndex + 1)}>Next</button></div>
        </div> : null}
        <button className="original-toc-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>↑ Back to top</button>
        {railFooter ? <div className="original-rail-meta">{railFooter}</div> : null}
      </nav>
      <div ref={columnRef} className="source-prose-column">
        {hasExplicitPages ? <p className="long-article-notice">This article is divided into {prepared.pages.length} pages. Use Previous / Next or the table of contents to move between pages.</p> : isLongArticle ? <p className="long-article-notice">Section navigation is enabled for this long article; the full text remains continuous.</p> : null}
        <div ref={articleRef} className="source-prose" lang={language} dangerouslySetInnerHTML={{ __html: prepared.pages[safePageIndex] ?? "" }} />
        {hasExplicitPages ? <nav className="article-page-navigation" aria-label="Article pages"><button type="button" disabled={safePageIndex === 0} onClick={() => goToPage(safePageIndex - 1)}>← Previous page</button><span>Page {safePageIndex + 1} of {prepared.pages.length}</span><button type="button" disabled={safePageIndex >= prepared.pages.length - 1} onClick={() => goToPage(safePageIndex + 1)}>Next page →</button></nav> : null}
        <div className="article-back-to-top"><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>↑ Back to top</button></div>
      </div>
    </div>
  );
}
