import { createHash } from 'node:crypto';
import { PUBLIC_ORIGIN, inspectCrawlPage } from './generate-crawl-artifacts.mjs';

const digest = body => createHash('sha256').update(body).digest('hex');
function validate(crawl) {
  if (crawl?.formatVersion !== 1 || crawl.origin !== PUBLIC_ORIGIN || typeof crawl.basePath !== 'string' || (crawl.basePath && !/^\/[a-zA-Z0-9_-]+$/.test(crawl.basePath)) || !Array.isArray(crawl.artifacts) || crawl.artifacts.length !== 2 || !Array.isArray(crawl.entries) || !crawl.entries.length || crawl.entries.length > 5000) throw new Error('Invalid crawl contract');
  for (const filename of ['robots.txt', 'sitemap.xml']) {
    const matches = crawl.artifacts.filter(value => value.path === filename);
    if (matches.length !== 1 || !/^[a-f0-9]{64}$/.test(matches[0].sha256 ?? '') || !Number.isSafeInteger(matches[0].bytes) || matches[0].bytes < 1 || matches[0].bytes > 8 * 1024 * 1024) throw new Error('Invalid crawl artifact identity');
  }
  const urls = new Set();
  for (const entry of crawl.entries) {
    if (typeof entry.path !== 'string' || !/(^|\/)index\.html$/.test(entry.path) || /[\\\x00-\x1f]/.test(entry.path) || entry.path.split('/').some(part => !part || part === '..' || part === '.')) throw new Error('Invalid crawl page identity');
    const pathname = '/' + entry.path.replace(/(?:^|\/)index\.html$/, '').split('/').map(encodeURIComponent).join('/');
    const expected = PUBLIC_ORIGIN + crawl.basePath + pathname + (pathname.endsWith('/') ? '' : '/');
    if (entry.url !== expected || urls.has(entry.url)) throw new Error('Invalid crawl URL identity');
    urls.add(entry.url);
  }
}

async function fetchText(url, { fetchImpl, timeoutMs, contentType, maxBytes }) {
  const response = await fetchImpl(url, { redirect: 'error', credentials: 'omit', cache: 'no-store', headers: { accept: contentType }, signal: AbortSignal.timeout(timeoutMs) });
  if (response.status !== 200) throw new Error(`Crawl request returned HTTP ${response.status}: ${new URL(url).pathname}`);
  const mime = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!contentType.split(', ').includes(mime)) throw new Error(`Unexpected crawl MIME ${mime}: ${new URL(url).pathname}`);
  if (/(?:^|[\s,;])(noindex|none)(?:$|[\s,;])/i.test(response.headers.get('x-robots-tag') ?? '')) throw new Error('Crawl response carries noindex header');
  if (!response.body) throw new Error('Empty crawl response');
  const reader = response.body.getReader(), chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error('Crawl response exceeded size limit');
      chunks.push(value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  return Buffer.concat(chunks);
}

/** Read-only deployment gate: check exact crawl bytes and every listed canonical HTML. */
export async function verifyCrawlArtifacts(crawl, { fetchImpl = globalThis.fetch, timeoutMs = 10_000, nonce = '' } = {}) {
  validate(crawl); // Reject external URLs and invalid paths before network access.
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) throw new Error('Invalid crawl timeout');
  const requestUrl = input => { const url = new URL(input); if (nonce) url.searchParams.set('verify', nonce); return url.toString(); };
  for (const artifact of crawl.artifacts) {
    const body = await fetchText(requestUrl(PUBLIC_ORIGIN + crawl.basePath + '/' + artifact.path), { fetchImpl, timeoutMs, contentType: artifact.path.endsWith('.xml') ? 'application/xml, text/xml' : 'text/plain', maxBytes: 8 * 1024 * 1024 });
    if (body.length !== artifact.bytes || digest(body) !== artifact.sha256) throw new Error(`Published crawl artifact does not match candidate: ${artifact.path}`);
  }
  let next = 0, failed = false;
  const results = await Promise.allSettled(Array.from({ length: Math.min(4, crawl.entries.length) }, async () => {
    while (!failed && next < crawl.entries.length) {
      try {
        const entry = crawl.entries[next++];
        const body = await fetchText(requestUrl(entry.url), { fetchImpl, timeoutMs, contentType: 'text/html', maxBytes: 8 * 1024 * 1024 });
        const page = inspectCrawlPage(body.toString('utf8'), entry.path, crawl.basePath);
        if (page.url !== entry.url) throw new Error(`Published sitemap URL lacks indexable self canonical HTML: ${entry.url} (${page.reason ?? 'mismatch'})`);
      } catch (error) { failed = true; throw error; }
    }
  }));
  const rejection = results.find(result => result.status === 'rejected');
  if (rejection) throw rejection.reason;
  return { artifacts: 2, canonicalPages: crawl.entries.length };
}
