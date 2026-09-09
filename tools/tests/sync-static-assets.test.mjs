import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { syncStaticAssets, restoreApprovedLogoDocument } from '../sync-static-assets.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const input = () => ({ data: { settings: {} }, migrated: { pages: [], posts: [] } });
const asset = (bytes, publicPaths = ['/favicon.png']) => ({ publicPaths, sourceBytes: bytes.length, sourceSha256: sha(bytes) });
async function cache() { await fs.mkdir('.cache', { recursive: true }); return fs.mkdtemp(path.resolve('.cache', 'static-test-')); }
async function withFetch(fake, callback) { const previous = globalThis.fetch; globalThis.fetch = fake; try { return await callback(); } finally { globalThis.fetch = previous; } }

test('downloads exact approved static bytes and reuses a validated content-addressed cache', async () => {
  const bytes = Buffer.from('exact static fixture');
  const cacheDir = await cache();
  let requests = 0;
  const args = { staticAssets: [asset(bytes, ['/design/brand-mark.webp'])], liveAssets: [], publicInput: input(), cacheDir };
  await withFetch(async (url, options) => { requests += 1; assert.equal(url, 'https://chaosong.heoa-group.chatgpt.site/design/brand-mark.webp'); assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit'); return new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } }); }, async () => {
    const first = await syncStaticAssets(args);
    const second = await syncStaticAssets(args);
    assert.equal(first.summary.downloaded, 1);
    assert.equal(second.summary.cacheHits, 1);
    assert.equal(requests, 1);
    assert.deepEqual(await fs.readFile(first.assets[0].outputPath), bytes);
    assert.equal(first.assets[0].outputFile, sha(bytes) + '.webp');
    assert.equal(first.assets[0].mode, 'original-preserved');
  });
});

test('reuses verified live bytes for explicitly retained historical media without downloading', async () => {
  const bytes = Buffer.from('verified live output'); const cacheDir = await cache();
  const outputFile = sha(bytes) + '.png'; const outputPath = path.join(cacheDir, outputFile); await fs.writeFile(outputPath, bytes, { flag: 'wx' });
  const publicInput = input(); publicInput.migrated.pages = [{ contentHtml: '<img src="/media/history.png">' }];
  const live = { ...asset(bytes, ['/cms-media/assets/live']), outputFile, outputPath, outputBytes: bytes.length, mode: 'original-preserved' };
  await withFetch(() => { throw new Error('Unexpected download'); }, async () => {
    const result = await syncStaticAssets({ staticAssets: [asset(bytes, ['/media/history.png', '/cms-media/assets/old'])], liveAssets: [live], publicInput, cacheDir });
    assert.equal(result.summary.reusedLive, 1);
    assert.equal(result.assets[0].outputPath, outputPath);
    assert.deepEqual(result.assets[0].publicPaths, ['/media/history.png']);
  });
});

test('does not restore a missing current CMS object or download arbitrary historical media', async () => {
  const bytes = Buffer.from('old'); const cacheDir = await cache(); const publicInput = input(); publicInput.data.body = 'asset:media_missing';
  await assert.rejects(syncStaticAssets({ staticAssets: [], liveAssets: [], publicInput, cacheDir }), /missing from the live catalog/);
  const history = input(); history.migrated.pages = [{ contentHtml: '/media/history.png' }];
  await withFetch(() => { throw new Error('Unexpected download'); }, () => assert.rejects(syncStaticAssets({ staticAssets: [asset(bytes, ['/media/history.png'])], liveAssets: [], publicInput: history, cacheDir }), /matching verified live object/));
});

test('rejects source hash or size changes and non-200 responses before caching', async () => {
  const expected = Buffer.from('good'); const cacheDir = await cache();
  const args = { staticAssets: [asset(expected)], liveAssets: [], publicInput: input(), cacheDir };
  for (const response of [new Response('evil'), new Response('too long'), new Response('', { status: 302 })]) {
    await withFetch(async () => response, () => assert.rejects(syncStaticAssets(args), /changed|approved size|HTTP 302/));
  }
  assert.deepEqual(await fs.readdir(cacheDir), []);
});

test('rejects path confusion and permits logo HTML only with its fixed approved hash', async () => {
  const bytes = Buffer.from('fixture'); const cacheDir = await cache();
  for (const alias of ['/design/../favicon.png', '/design/%2e%2e/favicon.png', '/design/%252e%252e/file.png', '/favicon.png?old=1']) {
    await assert.rejects(syncStaticAssets({ staticAssets: [asset(bytes, [alias])], liveAssets: [], publicInput: input(), cacheDir }), /Invalid|Unrecognized|traversal|outside/);
  }
  await assert.rejects(syncStaticAssets({ staticAssets: [asset(bytes, ['/bstvc-logo-motion.html'])], liveAssets: [], publicInput: input(), cacheDir }), /logo HTML hash is fixed/);
  const html = Buffer.from('<!DOCTYPE html><html>unexpected</html>');
  await withFetch(async () => new Response(html, { headers: { 'content-type': 'application/octet-stream' } }), () => assert.rejects(syncStaticAssets({ staticAssets: [asset(html)], liveAssets: [], publicInput: input(), cacheDir }), /HTML is forbidden/));
});

test('a corrupt cached original fails closed and cannot silently bypass verification', async () => {
  const bytes = Buffer.from('expected'); const cacheDir = await cache();
  await fs.writeFile(path.join(cacheDir, sha(bytes) + '.png'), 'modified', { flag: 'wx' });
  await withFetch(() => { throw new Error('Unexpected fallback download'); }, () => assert.rejects(syncStaticAssets({ staticAssets: [asset(bytes)], liveAssets: [], publicInput: input(), cacheDir }), /Static source bytes changed/));
});

test('logo reconstruction rejects arbitrary HTML even with a forged provider-script marker', () => {
  const forgedDocuments = [
    '<!DOCTYPE html><html><body>Unapproved replacement</body></html>',
    '<!DOCTYPE html>\n<html><body>Unapproved replacement<script src="/cdn-cgi/challenge-platform/fake.js"></script></body></html>',
    '<html><body>Unapproved replacement<script>/* /cdn-cgi/challenge-platform/ */ alert("forged")</script></body></html>',
    '<script>/* /cdn-cgi/challenge-platform/ */</script>',
  ];
  for (const document of forgedDocuments) {
    for (const text of [document, document.replace(/\n/g, '\r\n')]) {
      assert.throws(() => restoreApprovedLogoDocument(Buffer.from(text)), /differs from the approved document/);
    }
  }
});
