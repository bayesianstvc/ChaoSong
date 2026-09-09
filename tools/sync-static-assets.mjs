import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { selectMediaAliases } from './media-aliases.mjs';

const ORIGIN = 'https://chaosong.heoa-group.chatgpt.site';
const HTML_PATH = '/bstvc-logo-motion.html';
const HTML_SHA256 = 'dc540b9d3e82770445633761fb316452ca7a50267c97492af6192b87ebc0e119';
const DIRECT_PATHS = new Set([
  HTML_PATH, '/favicon.png', '/og.png', '/profile/chao-song-2025.jpg',
  '/design/brand-mark.webp', '/design/card-bstvc.webp', '/design/card-news.webp',
  '/design/card-publications.webp', '/design/card-research.webp', '/design/card-resources.webp',
  '/design/hero-accent.webp', '/design/hero-atlas.webp', '/design/paper-texture.webp',
]);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function validateAliases(aliases) {
  for (const alias of aliases) {
    if (typeof alias !== 'string' || !alias.startsWith('/') || alias.startsWith('//') || /[?#\\\x00-\x20\x7f]/.test(alias)) throw new Error('Invalid static public alias');
    let decoded;
    try { decoded = decodeURIComponent(alias); } catch { throw new Error('Invalid static alias encoding'); }
    if (/[\\\x00-\x1f\x7f]/.test(decoded) || /%[0-9a-f]{2}/i.test(decoded) || decoded.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('Static alias traversal or double encoding is forbidden');
    if (!DIRECT_PATHS.has(alias) && !alias.startsWith('/media/')) throw new Error('Static alias is outside the approved public paths');
  }
}

function verifyBytes(bytes, asset, downloadPath) {
  if (bytes.length !== asset.sourceBytes || digest(bytes) !== asset.sourceSha256) throw new Error(`Static source bytes changed: ${downloadPath}`);
  if (downloadPath !== HTML_PATH && /^\s*(?:<!doctype\s+html\b|<html\b)/i.test(bytes.subarray(0, 512).toString('utf8').replace(/^\uFEFF/, ''))) throw new Error('HTML is forbidden outside the approved logo document');
}

export function restoreApprovedLogoDocument(bytes) {
  // Sites adds a provider script and normalizes line endings to this public HTML.
  // Reconstruction is accepted only if the entire document matches the reviewed hash.
  const restored = Buffer.from(bytes.toString('utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, script => script.includes('/cdn-cgi/challenge-platform/') ? '' : script).replace(/\r?\n/g, '\r\n'));
  if (digest(restored) !== HTML_SHA256) throw new Error('The public logo document differs from the approved document');
  return restored;
}

async function downloadOriginal(asset, downloadPath) {
  const controller = new AbortController();
  let timer;
  const progress = () => { clearTimeout(timer); timer = setTimeout(() => controller.abort(new Error('Static download made no progress for 120 seconds')), 120000); };
  progress();
  try {
    // The deployed Sites asset router canonicalizes this exact HTML filename.
    // Use its verified same-origin canonical path directly; redirects remain forbidden.
    const requestPath = downloadPath === HTML_PATH ? '/bstvc-logo-motion' : downloadPath;
    const response = await fetch(ORIGIN + requestPath, { redirect: 'error', credentials: 'omit', signal: controller.signal });
    progress();
    if (response.status !== 200 || !response.body) throw new Error(`Static download failed: ${downloadPath} HTTP ${response.status}`);
    if (downloadPath !== HTML_PATH && /^text\/html(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) throw new Error('HTML response is forbidden for an image path');
    const chunks = [];
    let received = 0;
    for await (const chunk of response.body) {
      progress(); received += chunk.byteLength;
      if (received > asset.sourceBytes + (downloadPath === HTML_PATH ? 65536 : 0)) throw new Error(`Static source exceeds its approved size: ${downloadPath}`);
      chunks.push(Buffer.from(chunk));
    }
    const downloaded = Buffer.concat(chunks, received);
    const bytes = downloadPath === HTML_PATH ? restoreApprovedLogoDocument(downloaded) : downloaded;
    verifyBytes(bytes, asset, downloadPath);
    return bytes;
  } finally { clearTimeout(timer); controller.abort(); }
}

async function saveOriginal(file, bytes) {
  try { await fs.writeFile(file, bytes, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (!bytes.equals(await fs.readFile(file))) throw new Error('Concurrent static cache content mismatch');
  }
}

/** Restore only explicitly selected public static assets; CMS data has no old-catalog fallback. */
export async function syncStaticAssets({ staticAssets, liveAssets, publicInput, cacheDir } = {}) {
  if (typeof cacheDir !== 'string' || !cacheDir) throw new Error('A static cache directory is required');
  const selection = selectMediaAliases({ staticAssets, liveAssets, publicInput });
  // selectMediaAliases appends the original live array after its selected static prefix.
  const selected = selection.assets.slice(0, selection.assets.length - liveAssets.length);
  const cacheRoot = path.resolve(cacheDir);
  const results = [];
  const summary = { selected: selected.length, reusedLive: 0, cacheHits: 0, downloaded: 0, downloadedBytes: 0 };
  for (const asset of selected) {
    if (!/^[a-f0-9]{64}$/.test(asset.sourceSha256 ?? '') || !Number.isSafeInteger(asset.sourceBytes) || asset.sourceBytes < 1) throw new Error('Static source SHA-256 and size are required');
    validateAliases(asset.publicPaths);
    if (asset.publicPaths.includes(HTML_PATH) && asset.sourceSha256 !== HTML_SHA256) throw new Error('The approved logo HTML hash is fixed');
    const reusable = liveAssets.find(live => live.sourceSha256 === asset.sourceSha256 && live.sourceBytes === asset.sourceBytes);
    if (reusable) {
      if (typeof reusable.outputPath !== 'string' || typeof reusable.outputFile !== 'string' || path.basename(reusable.outputFile) !== reusable.outputFile || /[\\/:]/.test(reusable.outputFile)) throw new Error('Verified live output location is invalid');
      const status = await fs.stat(reusable.outputPath);
      if (!status.isFile() || status.size !== reusable.outputBytes) throw new Error('Verified live output is unavailable or changed');
      results.push({ ...asset, ...reusable, publicPaths: asset.publicPaths, reusedLive: true });
      summary.reusedLive += 1;
      continue;
    }
    const downloadPath = asset.publicPaths.find(alias => DIRECT_PATHS.has(alias));
    if (!downloadPath) throw new Error('Historical media requires a matching verified live object; no stale static fallback is allowed');
    const extension = path.posix.extname(downloadPath).slice(1).toLowerCase();
    const outputFile = `${asset.sourceSha256}.${extension}`;
    const outputPath = path.join(cacheRoot, outputFile);
    let bytes;
    let cacheHit = false;
    try { bytes = await fs.readFile(outputPath); verifyBytes(bytes, asset, downloadPath); cacheHit = true; }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      bytes = await downloadOriginal(asset, downloadPath);
      await fs.mkdir(cacheRoot, { recursive: true });
      await saveOriginal(outputPath, bytes);
    }
    results.push({ ...asset, outputPath, outputFile, sourcePath: outputPath, sourceBytes: bytes.length, outputBytes: bytes.length, sourceSha256: asset.sourceSha256, outputSha256: asset.sourceSha256, mode: 'original-preserved', format: extension, qualityEvidence: { byteExactOriginal: true, reason: 'Approved static original verified by SHA-256 and byte size' }, cacheHit, reusedLive: false });
    if (cacheHit) summary.cacheHits += 1;
    else { summary.downloaded += 1; summary.downloadedBytes += bytes.length; }
  }
  return { assets: results, summary };
}
