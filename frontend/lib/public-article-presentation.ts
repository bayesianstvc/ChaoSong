import { decodeHtmlEntities } from './html-entities.ts';

const FOLLOW_SLUG = 'follow-bstvc-bstvc-2026-11-18-9e9c32';
const followAlias = new RegExp(`^(?:https://chaosong\\.heoa-group\\.chatgpt\\.site)?/pages/${FOLLOW_SLUG}/?([?#].*)?$`, 'i');
const previousProfile = /^https?:\/\/(?:www\.)?researchgate\.net\/profile\/Chao_Song15\/?$/i;
const profileUrl = /^https:\/\/(?:www\.)?researchgate\.net\/profile\/[\w.-]+\/?$/i;
const block = /^(?:p|h[1-6]|li|figcaption)$/;
const rawText = /^(?:script|style|textarea|title)$/;
const voidElement = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;

function mostlyChinese(text: string, heading: boolean) {
  const han = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  const latinWords = text.match(/\p{Script=Latin}+/gu)?.length ?? 0;
  return han >= (heading ? 4 : 8) && han >= 2 * latinWords;
}

/** Recognize two explicit language segments; keep every character of the display text. */
export function splitBilingualHeading(value: string) {
  const [before, divider, after, ...extra] = value.split(/(\s+(?:[·|｜—–/]|&(?:middot|mdash|ndash);|&#(?:183|8211|8212);)\s+)/i);
  if (!divider || !before?.trim() || !after?.trim() || extra.length) return null;
  function detect(segment: string) {
    const decoded = decodeHtmlEntities(segment);
    const han = decoded.match(/\p{Script=Han}/gu)?.length ?? 0;
    if (!han) return /\p{Script=Latin}/u.test(decoded) ? 'en' : null;
    const latinWords = decoded.match(/\p{Script=Latin}+/gu)?.length ?? 0;
    return han >= 2 && han >= 2 * latinWords ? 'zh' : null;
  }
  const beforeLang = detect(before);
  const afterLang = detect(after);
  return beforeLang && afterLang && beforeLang !== afterLang ? { before, divider, after, beforeLang, afterLang } : null;
}

type PublicArticle = { slug: string; type: string; language: string };
type Presentation = { hasPublishedFollow: boolean; researchGateUrl: string; basePath?: string };
type Element = { name: string; start: number; openingEnd: number; attr: string; text: string; preserveLanguage: boolean; hasLanguageChild: boolean; skipText: boolean };
type Edit = { start: number; end: number; value: string };

/** Adjust only presentation of current published bodies. Source Markdown and archived HTML stay intact. */
export function refinePublishedArticleHtml(html: string, article: PublicArticle, options: Presentation) {
  const tags = /<!--[\s\S]*?-->|<(\/?)([a-z][\w:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi;
  const attrs = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const stack: Element[] = [];
  const edits: Edit[] = [];
  const about = article.type === 'page' && article.slug === 'about';
  const publications = article.type === 'page' && article.slug === 'publications';
  const profile = (about || publications) && profileUrl.test(options.researchGateUrl) ? options.researchGateUrl : '';
  const follow = options.hasPublishedFollow ? `${options.basePath ?? ''}/${FOLLOW_SLUG}/` : '';
  let previous = 0;
  let raw = '';

  for (const m of html.matchAll(tags)) {
    const start = m.index!;
    if (!stack.at(-1)?.skipText && start > previous) {
      const item = stack.findLast(node => block.test(node.name));
      if (item) item.text += ' ' + decodeHtmlEntities(html.slice(previous, start));
    }
    previous = start + m[0].length;
    if (!m[2]) continue; // Comment: do not interpret any markup inside it.
    const name = m[2].toLowerCase();
    if (raw && !(m[1] && name === raw)) continue;
    if (m[1]) {
      if (name === raw) raw = '';
      const index = stack.findLastIndex(node => node.name === name);
      if (index < 0) continue;
      const item = stack[index];
      stack.length = index;
      if (!block.test(name) || item.skipText) continue;
      const text = item.text.trim().replace(/\s+/g, ' ');
      const recognizeTopic = publications && name === 'p' && !/content-gallery-caption/i.test(item.attr) &&
        /^\s*<(?:strong|b)\b/i.test(html.slice(item.openingEnd, start)) && /^TOPIC\s+(?:I{1,3}|[1-3])\s*[:：]/i.test(text);
      const aboutHeading = about && name === 'h1' && /^(?:Academic Links|Chao Song\s*\/\s*宋超|Related People\s*[:：])$/i.test(text);
      if (recognizeTopic || aboutHeading) {
        edits.push({ start: item.start + 1, end: item.start + 1 + name.length, value: 'h2' });
        edits.push({ start: start + 2, end: start + 2 + name.length, value: 'h2' });
      }
      if (article.language === 'en' && !item.preserveLanguage && !item.hasLanguageChild) {
        const heading = /^h[1-6]$/.test(name) || recognizeTopic;
        const authored = html.slice(item.openingEnd, start);
        const bilingual = heading && !/[<>]/.test(authored) ? splitBilingualHeading(authored) : null;
        if (bilingual) {
          const { before, divider, after, beforeLang, afterLang } = bilingual;
          edits.push({ start: item.openingEnd, end: start, value: `<span lang="${beforeLang}">${before}</span>${divider}<span lang="${afterLang}">${after}</span>` });
        } else if (mostlyChinese(text, heading)) {
          edits.push({ start: item.openingEnd - 1, end: item.openingEnd - 1, value: ' lang="zh"' });
        }
      }
      continue;
    }
    const attributes = new Map<string, RegExpMatchArray>();
    for (const attr of m[3].matchAll(attrs)) {
      const key = attr[1].toLowerCase();
      if (!attributes.has(key)) attributes.set(key, attr);
    }
    const value = (attr?: RegExpMatchArray) => attr?.[2] ?? attr?.[3] ?? attr?.[4];
    const link = name === 'a' ? attributes.get('href') : undefined;
    const href = value(link);
    if (link && href && !stack.at(-1)?.skipText) {
      const alias = follow ? href.match(followAlias) : null;
      const target = alias ? follow + (alias[1] ?? '') : profile && previousProfile.test(href) ? profile : null;
      if (target && target !== href) {
        const attrStart = start + 1 + m[2].length + link.index!;
        const hrefOffset = link[0].length - href.length - (link[4] === undefined ? 1 : 0);
        edits.push({ start: attrStart + hrefOffset, end: attrStart + hrefOffset + href.length, value: target });
      }
    }
    if (voidElement.test(name) || /\/\s*>$/.test(m[0])) continue;
    if (rawText.test(name)) raw = name;
    const parent = stack.at(-1);
    if (attributes.has('lang')) {
      const containingBlock = stack.findLast(node => block.test(node.name));
      if (containingBlock) containingBlock.hasLanguageChild = true;
    }
    const skipText = Boolean(parent?.skipText || raw || /^(?:code|pre|math|svg|template)$/.test(name) ||
      /(?:^|\s)(?:katex(?:-display)?|math-inline|inline-math)(?:\s|$)/i.test(value(attributes.get('class')) ?? ''));
    stack.push({ name, start, openingEnd: previous, attr: m[3], text: '', skipText,
      hasLanguageChild: false, preserveLanguage: Boolean(parent?.preserveLanguage || attributes.has('lang')) });
  }
  if (!edits.length) return html;
  edits.sort((a, b) => a.start - b.start);
  const parts: string[] = [];
  let offset = 0;
  for (const edit of edits) {
    parts.push(html.slice(offset, edit.start), edit.value);
    offset = edit.end;
  }
  parts.push(html.slice(offset));
  return parts.join('');
}

export function isPublishedFollowPage(entry: { type: string; slug: string }) {
  return entry.type === 'page' && entry.slug === FOLLOW_SLUG;
}
