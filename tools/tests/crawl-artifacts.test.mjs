import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { PUBLIC_ORIGIN, generateCrawlArtifacts, inspectCrawlPage } from '../generate-crawl-artifacts.mjs';
import { verifyCrawlArtifacts } from '../verify-crawl-artifacts.mjs';
import { verifyPublishedRelease } from '../verify-published-site.mjs';

const html = (route, extra = '') => `<!doctype html><html><head><link rel="canonical" href="${PUBLIC_ORIGIN}${route}">${extra}</head><body>Published page</body></html>`;
async function fixture() {
  const site = await mkdtemp(path.join(tmpdir(), 'chaosong-crawl-'));
  const pages = new Map([
    ['index.html', html('/')],
    ['news/bstvc-desktop-v2-release/index.html', html('/news/bstvc-desktop-v2-release/')],
    ['follow-bstvc-bstvc-2026-11-18-9e9c32/index.html', html('/follow-bstvc-bstvc-2026-11-18-9e9c32/')],
    ['中文 & English/index.html', html('/%E4%B8%AD%E6%96%87%20%26%20English/')],
    ['search/index.html', html('/search/', '<meta name="robots" content="noindex, follow">')],
    ['pages/alias/index.html', html('/news/bstvc-desktop-v2-release/')],
    ['archive/alias/index.html', html('/archive/alias/', '<meta name="googlebot" content="none">')],
    ['404.html', '<!doctype html><html><head></head><body>Not found</body></html>'],
  ]);
  const manifest = [];
  for (const [filename, body] of pages) {
    await mkdir(path.dirname(path.join(site, filename)), { recursive: true });
    await writeFile(path.join(site, filename), body, 'utf8');
    manifest.push({ path: filename, bytes: Buffer.byteLength(body) });
  }
  return { site, manifest };
}

test('sitemap derives only finalized canonical HTML, including current V2 and Follow and Unicode paths', async () => {
  const { site, manifest } = await fixture();
  const crawl = await generateCrawlArtifacts({ site, manifest, requiredRoutes: ['/'] });
  assert.equal(crawl.entries.length, 4);
  const xml = await readFile(path.join(site, 'sitemap.xml'), 'utf8');
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/);
  assert.match(xml, /https:\/\/chaosong\.blog\/news\/bstvc-desktop-v2-release\//);
  assert.match(xml, /https:\/\/chaosong\.blog\/follow-bstvc-bstvc-2026-11-18-9e9c32\//);
  assert.match(xml, /%E4%B8%AD%E6%96%87%20%26%20English/);
  assert.doesNotMatch(xml, /search|pages\/alias|archive|404/);
  assert.deepEqual(crawl.excluded.map(entry => entry.reason).sort(), ['noindex', 'noindex', 'non-self canonical', 'not a directory HTML page'].sort());
  const robots = await readFile(path.join(site, 'robots.txt'), 'utf8');
  assert.match(robots, /Sitemap: https:\/\/chaosong\.blog\/sitemap.xml\n$/);
  assert.doesNotMatch(robots, /Disallow: \/search/);
  for (const artifact of crawl.artifacts) assert.equal(Buffer.byteLength(await readFile(path.join(site, artifact.path))), artifact.bytes);
  await assert.rejects(generateCrawlArtifacts({ site, manifest, requiredRoutes: ['/'] }), /EEXIST/);
});

test('requires real canonical HTML at core routes and never invents missing or hidden pages', async () => {
  const { site, manifest } = await fixture();
  await assert.rejects(generateCrawlArtifacts({ site, manifest, requiredRoutes: ['/', '/missing/'] }), /Missing indexable canonical HTML.*missing/);
  await assert.rejects(generateCrawlArtifacts({ site, manifest, requiredRoutes: ['/search/'] }), /Missing indexable canonical HTML.*search/);
  await assert.rejects(generateCrawlArtifacts({ site, manifest, requiredRoutes: ['/'], publishedRoutes: ['/pages/alias'] }), /Published route lacks canonical finalized HTML/);
  await assert.rejects(generateCrawlArtifacts({ site, manifest, requiredRoutes: ['/'], publishedRoutes: ['/missing-published-page'] }), /Published route lacks canonical finalized HTML/);
  await assert.rejects(readFile(path.join(site, 'sitemap.xml')), /ENOENT/);
  const crawl = await generateCrawlArtifacts({ site, manifest, requiredRoutes: ['/'], publishedRoutes: ['/search', '/news/bstvc-desktop-v2-release', '/follow-bstvc-bstvc-2026-11-18-9e9c32'] });
  assert.equal(crawl.entries.length, 4);
});

test('canonical and noindex parsing rejects misleading head metadata and ignores scripts and comments', () => {
  const cases = [
    [html('/about/', '<meta content="NOINDEX, follow" name="ROBOTS">'), 'noindex'],
    [html('/about/', '<meta name="bingbot" content="none">'), 'noindex'],
    [html('/about/', '<link rel="canonical" href="https://chaosong.blog/about/">'), 'multiple canonicals'],
    [html('/about/?x=1'), 'non-public canonical'],
    [html('/about/#x'), 'non-public canonical'],
    [html('/about/').replace(PUBLIC_ORIGIN, 'https://example.test'), 'non-public canonical'],
    [html('/elsewhere/'), 'non-self canonical'],
    ['<html><head></head><body></body></html>', 'missing canonical'],
    [html('/studio/'), 'non-public route'],
  ];
  for (const [source, reason] of cases) assert.equal(inspectCrawlPage(source, reason === 'non-public route' ? 'studio/index.html' : 'about/index.html').reason, reason);
  assert.equal(inspectCrawlPage(html('/about/', '<!-- <meta name="robots" content="noindex"> --><script>"<meta name=robots content=noindex>"</script>'), 'about/index.html').url, PUBLIC_ORIGIN + '/about/');
  assert.equal(inspectCrawlPage(html('/preview/about/'), 'about/index.html', '/preview').url, PUBLIC_ORIGIN + '/preview/about/');
});

test('published release performs real local HTTP artifact hash, MIME and every sitemap HTML gate', async t => {
  const { site, manifest } = await fixture();
  const crawl = await generateCrawlArtifacts({ site, manifest, requiredRoutes: ['/'] });
  const candidate = { formatVersion: 1, generation: 'a'.repeat(64), rendererRevision: 'b'.repeat(40), crawl };
  let fault = '', requests = 0;
  const server = http.createServer(async (request, response) => {
    requests++;
    const route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filename = route === '/release.json' ? 'release.json' : route.endsWith('/') ? route.slice(1) + 'index.html' : route.slice(1);
    const mime = filename.endsWith('.xml') ? 'application/xml' : filename.endsWith('.html') ? 'text/html' : filename.endsWith('.txt') ? 'text/plain' : 'application/json';
    response.setHeader('content-type', fault === 'mime' && filename === 'sitemap.xml' ? 'text/html' : mime);
    if (fault === 'header' && filename === 'index.html') response.setHeader('x-robots-tag', 'noindex');
    if (fault === '404' && filename === 'sitemap.xml') { response.writeHead(404).end('missing'); return; }
    if (filename === 'release.json') { response.end(JSON.stringify(candidate)); return; }
    const body = await readFile(path.join(site, filename));
    response.end(fault === 'hash' && filename === 'robots.txt' ? 'wrong bytes' : fault === 'canonical' && filename === 'index.html' ? html('/wrong/') : body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const fetchImpl = (input, options) => {
    assert.equal(new URL(input).origin, PUBLIC_ORIGIN);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    return fetch(`http://127.0.0.1:${server.address().port}${new URL(input).pathname}${new URL(input).search}`, options);
  };
  const result = await verifyPublishedRelease(candidate, { fetchImpl, attempts: 1, log: () => {} });
  assert.deepEqual(result.crawl, { artifacts: 2, canonicalPages: 4 });
  assert.equal(requests, 7); // release + both artifacts + every listed HTML URL.
  for (const issue of ['hash', 'mime', '404', 'canonical', 'header']) {
    fault = issue;
    await assert.rejects(verifyPublishedRelease(candidate, { fetchImpl, attempts: 1, log: () => {} }), /Published release verification failed/);
  }
  await assert.rejects(verifyCrawlArtifacts({ ...crawl, entries: [{ path: '../index.html', url: 'https://example.test/' }] }, { fetchImpl: () => assert.fail('Invalid crawl contract must not fetch') }), /Invalid crawl page identity/);
});
