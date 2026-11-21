import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const PUBLIC_ORIGIN = 'https://chaosong.blog';
export const REQUIRED_CRAWL_ROUTES = ['/', '/about/', '/bstvc/', '/research/', '/publications/', '/resources/', '/news/', '/blogs/'];
const escapeXml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const decode = value => value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
  const code = entity.slice(1, -1).toLowerCase();
  if (!code.startsWith('#')) return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }[code];
  const number = code[1] === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
  return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '\ufffd';
});

function* metadataTags(html) {
  // Ignore comments and raw text: serialized React payloads may contain fake tags.
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  const clean = head.replace(/<!--[\s\S]*?-->|<(script|style|title)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  for (const match of clean.matchAll(/<(meta|link)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi)) {
    const attrs = new Map();
    for (const value of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const key = value[1].toLowerCase();
      if (!attrs.has(key)) attrs.set(key, decode(value[2] ?? value[3] ?? value[4] ?? ''));
    }
    yield { tag: match[1].toLowerCase(), attrs };
  }
}

export function inspectCrawlPage(html, file, basePath = '') {
  if (!/(^|\/)index\.html$/.test(file)) return { reason: 'not a directory HTML page' };
  const route = '/' + file.replace(/(?:^|\/)index\.html$/, '').split('/').map(encodeURIComponent).join('/');
  const expected = PUBLIC_ORIGIN + basePath + (route.endsWith('/') ? route : route + '/');
  const tags = [...metadataTags(html)];
  if (tags.some(({ tag, attrs }) => tag === 'meta' && /^(robots|googlebot|bingbot)$/i.test(attrs.get('name') ?? '') && /(?:^|[\s,;])(noindex|none)(?:$|[\s,;])/i.test(attrs.get('content') ?? ''))) return { reason: 'noindex' };
  const canonical = tags.filter(({ tag, attrs }) => tag === 'link' && (attrs.get('rel') ?? '').toLowerCase().split(/\s+/).includes('canonical'));
  if (canonical.length !== 1) return { reason: canonical.length ? 'multiple canonicals' : 'missing canonical' };
  const href = canonical[0].attrs.get('href');
  let url;
  try { url = new URL(href); } catch { return { reason: 'invalid canonical' }; }
  if (url.origin !== PUBLIC_ORIGIN || url.username || url.password || url.search || url.hash) return { reason: 'non-public canonical' };
  // Exact self identity excludes aliases, archive aliases and old base-path URLs.
  if (url.href !== expected) return { reason: 'non-self canonical' };
  if (/^\/(?:studio|api|_next|validation-preview|drafts?)(?:\/|$)/i.test(route)) return { reason: 'non-public route' };
  return { url: expected, route: basePath + route };
}

/** Derive crawl files only after HTML metadata and publication closure are finalized. */
export async function generateCrawlArtifacts({ site, manifest, basePath = '', requiredRoutes = REQUIRED_CRAWL_ROUTES, publishedRoutes = [] }) {
  if (basePath && !/^\/[a-zA-Z0-9_-]+$/.test(basePath)) throw new Error('Invalid crawl base path');
  const entries = [], excluded = [];
  for (const file of manifest.filter(value => value.path.endsWith('.html')).sort((a, b) => a.path.localeCompare(b.path, 'en'))) {
    const parts = file.path.split('/');
    if (path.isAbsolute(file.path) || parts.some(part => !part || part === '..' || part === '.') || /[\\\x00-\x1f]/.test(file.path)) throw new Error('Unsafe crawl HTML path');
    const html = await readFile(path.join(site, file.path), 'utf8');
    const result = inspectCrawlPage(html, file.path, basePath);
    if (result.url) entries.push({ path: file.path, url: result.url });
    else excluded.push({ path: file.path, reason: result.reason });
  }
  const urls = new Set(entries.map(entry => entry.url));
  // A published CMS route must not silently disappear because of a broken
  // canonical. Deliberately noindex content remains excluded from the sitemap.
  for (const route of publishedRoutes) {
    const expected = PUBLIC_ORIGIN + basePath + route.replace(/\/$/, '') + '/';
    if (urls.has(expected)) continue;
    const relative = decodeURIComponent(route).replace(/^\/|\/$/g, '');
    const file = relative ? relative + '/index.html' : 'index.html';
    if (!excluded.some(value => value.path === file && value.reason === 'noindex')) throw new Error(`Published route lacks canonical finalized HTML: ${route}`);
  }
  for (const route of requiredRoutes) {
    if (!route.startsWith('/') || !route.endsWith('/') || !urls.has(PUBLIC_ORIGIN + basePath + route)) throw new Error(`Missing indexable canonical HTML for required crawl route: ${route}`);
  }
  if (urls.size !== entries.length) throw new Error('Duplicate sitemap URL');
  const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + entries.map(entry => `  <url><loc>${escapeXml(entry.url)}</loc></url>`).join('\n') + '\n</urlset>\n';
  // Search stays crawlable so crawlers can observe its noindex metadata.
  const robots = `User-agent: *\nAllow: /\nDisallow: /studio/\nDisallow: /api/\n\nSitemap: ${PUBLIC_ORIGIN}${basePath}/sitemap.xml\n`;
  const artifacts = [];
  for (const [filename, body] of [['robots.txt', robots], ['sitemap.xml', sitemap]]) {
    await writeFile(path.join(site, filename), body, { encoding: 'utf8', flag: 'wx' });
    artifacts.push({ path: filename, bytes: Buffer.byteLength(body), sha256: sha256(body) });
  }
  return { formatVersion: 1, origin: PUBLIC_ORIGIN, basePath, entries, excluded, artifacts, requiredUrls: requiredRoutes.map(route => PUBLIC_ORIGIN + basePath + route) };
}
