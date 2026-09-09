import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

export const API_ORIGIN = 'https://chaosong.heoa-group.chatgpt.site';
const POLICY = 'public-media-lossless-original-size-v1';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const mediaType = (value) => String(value || '').split(';', 1)[0].trim().toLowerCase();
const WECHAT_REPAIR = Object.freeze({
  id: 'wechat-import-html-correction-v1',
  assetId: 'media_legacy_0c0d2a783bf4c99b2a6f9a13',
  objectKey: 'assets/media_legacy_0c0d2a783bf4c99b2a6f9a13/f290d022aa10-wechat.png',
  badSha256: '0c0d2a783bf4c99b2a6f9a134ae12f6d90278993a069791d02f9d41cbb38ad42',
  badBytes: 222129,
  targetAssetId: 'media_legacy_7ab7d311deaca0142d27eef3',
  targetObjectKey: 'assets/media_legacy_7ab7d311deaca0142d27eef3/36a43aa009d3-wechat.png',
  replacementSha256: '7ab7d311deaca0142d27eef384550cfa5e87d982de4c51f8bc9131d73ca7bff0',
  replacementBytes: 299785,
  reason: 'The authored image is the valid current PNG, but its enlargement link was imported from a GitHub HTML page. Resolve that exact broken link to the same currently published PNG; retain both production objects unchanged.',
});
export function knownMediaCorrection(asset) {
  return asset.id === WECHAT_REPAIR.assetId && asset.objectKey === WECHAT_REPAIR.objectKey &&
    asset.sha256 === WECHAT_REPAIR.badSha256 && asset.byteSize === WECHAT_REPAIR.badBytes &&
    mediaType(asset.contentType) === 'image/png' ? WECHAT_REPAIR : null;
}

function strongEtag(value) {
  if (typeof value !== 'string' || !value || /[\x00-\x20\x7f]/.test(value) || value.startsWith('W/') || value === '*') throw new Error('A strong media ETag is required');
  if (/^"[^"\\]+"$/.test(value)) return value;
  if (/^[A-Za-z0-9._:-]+$/.test(value)) return `"${value}"`;
  throw new Error('Invalid media ETag');
}

function validateAsset(asset, origin) {
  if (!asset || typeof asset.id !== 'string' || typeof asset.objectKey !== 'string' || !asset.objectKey) throw new Error('Media identity is required');
  if (!Number.isSafeInteger(asset.byteSize) || asset.byteSize < 0) throw new Error(`Invalid media byte size: ${asset.id}`);
  const p = asset.downloadPath;
  if (typeof p !== 'string' || !/^\/cms-media\/(uploads|assets)\//.test(p) || /[?#\\\x00-\x20\x7f]/.test(p)) throw new Error(`Invalid media download path: ${asset.id}`);
  let decoded;
  try { decoded = decodeURIComponent(p); } catch { throw new Error('Invalid URL encoding'); }
  if (/[\\\x00-\x1f\x7f]/.test(decoded) || decoded.split('/').some(x => x === '.' || x === '..') || /%[0-9a-f]{2}/i.test(decoded)) throw new Error('Media path traversal or double encoding is forbidden');
  const url = new URL(p, origin);
  if (url.origin !== API_ORIGIN || url.username || url.password || url.hash || url.search || url.pathname !== p) throw new Error('Media request must retain the approved origin and path');
  if (decoded.slice('/cms-media/'.length) !== asset.objectKey) throw new Error(`Media path must address the exact object key: ${asset.id}`);
  if (!Array.isArray(asset.publicPaths) || asset.publicPaths.some(x => typeof x !== 'string' || !x.startsWith('/') || x.startsWith('//') || /[\\\x00-\x1f\x7f]/.test(x))) throw new Error('publicPaths must contain root-relative paths');
  if (asset.sha256 != null && !/^[a-f0-9]{64}$/i.test(asset.sha256)) throw new Error('Invalid media SHA-256');
  return { ...asset, etag: strongEtag(asset.etag), contentType: mediaType(asset.contentType), url: url.href };
}

async function writeOriginal(file, bytes) {
  try { await fs.writeFile(file, bytes, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (!bytes.equals(await fs.readFile(file))) throw new Error(`Cached bytes differ: ${path.basename(file)}`);
  }
}

function cachedFile(dir, name) {
  if (typeof name !== 'string' || path.basename(name) !== name || !/^[a-f0-9]{64}\.[a-z0-9]{1,8}$/.test(name)) throw new Error('Invalid cached filename');
  return path.join(dir, name);
}

async function download(asset, onProgress) {
  const controller = new AbortController();
  let timeout;
  // This is a no-progress timeout; received bytes extend it rather than ending a healthy slow transfer.
  const tick = () => { clearTimeout(timeout); timeout = setTimeout(() => controller.abort(new Error('Media transfer made no progress for 120 seconds')), 120000); };
  tick();
  try {
    const response = await fetch(asset.url, { headers: { 'If-Match': asset.etag }, redirect: 'error', credentials: 'omit', signal: controller.signal });
    tick();
    if (response.status !== 200) throw new Error(`Media download failed: ${asset.id} HTTP ${response.status}`);
    if (strongEtag(response.headers.get('etag')) !== asset.etag) throw new Error(`Media ETag changed: ${asset.id}`);
    if (mediaType(response.headers.get('content-type')) !== asset.contentType) throw new Error(`Media content type changed: ${asset.id}`);
    if (!response.body) throw new Error(`Missing media response body: ${asset.id}`);
    const chunks = [];
    let received = 0;
    for await (const chunk of response.body) {
      tick(); received += chunk.byteLength;
      if (received > asset.byteSize) throw new Error(`Media is larger than its manifest: ${asset.id}`);
      chunks.push(Buffer.from(chunk));
      onProgress?.({ id: asset.id, receivedBytes: received, expectedBytes: asset.byteSize });
    }
    if (received !== asset.byteSize) throw new Error(`Media byte size changed: ${asset.id}`);
    const bytes = Buffer.concat(chunks, received);
    if (asset.sha256 && digest(bytes) !== asset.sha256.toLowerCase()) throw new Error(`Media SHA-256 changed: ${asset.id}`);
    return bytes;
  } finally { clearTimeout(timeout); controller.abort(); }
}

async function optimize(bytes, asset) {
  const extension = path.posix.extname(asset.objectKey).slice(1).toLowerCase();
  const originalFormat = /^[a-z0-9]{1,8}$/.test(extension) ? extension : 'bin';
  let chosen = bytes;
  let format = originalFormat;
  let meta;
  let mode = 'original-preserved';
  let qualityEvidence = { byteExactOriginal: true, reason: 'Original format, dimensions and bytes preserved' };
  // SVG, PDF, video and other assets are never rasterized or transcoded.
  if (/^image\/(jpeg|png|webp|avif|tiff|gif|heif|heic)$/.test(asset.contentType)) {
    try { meta = await sharp(bytes, { animated: true }).metadata(); }
    catch (error) { throw new Error(`Published media is not a decodable image: ${asset.id}`, { cause: error }); }
    const canConvert = (meta.pages || 1) === 1 && meta.depth === 'uchar' && meta.width <= 16383 && meta.height <= 16383;
    if (canConvert) {
      const raw = (input) => sharp(input).autoOrient().toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const candidate = await sharp(bytes).autoOrient().keepIccProfile().webp({ lossless: true, effort: 5 }).toBuffer();
      if (candidate.length < bytes.length) {
        const before = await raw(bytes);
        const after = await raw(candidate);
        const sameDimensions = before.info.width === after.info.width && before.info.height === after.info.height;
        const decodedPixelExact = sameDimensions && before.data.equals(after.data);
        qualityEvidence = { byteExactOriginal: !decodedPixelExact, sameDimensions, decodedPixelExact, comparison: '8-bit sRGB RGBA after EXIF orientation', candidateBytes: candidate.length };
        if (decodedPixelExact) { chosen = candidate; format = 'webp'; mode = 'scientific-lossless-webp-original-dimensions'; }
      } else qualityEvidence.reason = 'Lossless candidate is not smaller; original bytes preserved';
    } else qualityEvidence.reason = 'Animation, bit depth or dimensions require original-byte preservation';
  }
  const dimensions = meta?.autoOrient || meta;
  return { bytes: chosen, format, mode, width: dimensions?.width ?? null, height: dimensions?.height ?? null, qualityEvidence };
}

/** Download immutable published media only; preserve original cache and return a local portable catalog. */
export async function syncMedia({ assets, cacheDir, apiOrigin = API_ORIGIN, generation, onProgress } = {}) {
  if (apiOrigin !== API_ORIGIN) throw new Error('Only the approved Sites origin is allowed');
  if (!Array.isArray(assets) || typeof cacheDir !== 'string' || !cacheDir) throw new Error('assets and cacheDir are required');
  const validated = assets.map(x => validateAsset({ ...x, correction: undefined }, apiOrigin));
  const input = validated.map(asset => {
    const correction = knownMediaCorrection(asset);
    if (!correction) return asset;
    const target = validated.find(x => x.id === correction.targetAssetId && x.objectKey === correction.targetObjectKey && x.sha256 === correction.replacementSha256 && x.byteSize === correction.replacementBytes && x.contentType === 'image/png');
    if (!target) throw new Error('The historical image link correction requires its exact current published PNG; no archived fallback is allowed');
    return { ...target, id: asset.id, publicPaths: asset.publicPaths, correction };
  });
  cacheDir = path.resolve(cacheDir);
  const originalDir = path.join(cacheDir, 'originals');
  const derivedDir = path.join(cacheDir, 'optimized');
  const recordDir = path.join(cacheDir, 'records');
  await Promise.all([originalDir, derivedDir, recordDir].map(dir => fs.mkdir(dir, { recursive: true })));
  const policy = { policy: POLICY, sharp: sharp.versions.sharp, vips: sharp.versions.vips, webp: sharp.versions.webp };
  const active = new Map();
  let index = 0;
  let failed = false;
  const result = new Array(input.length);

  async function one(asset) {
    const cacheKey = digest(JSON.stringify({ objectKey: asset.objectKey, etag: asset.etag, byteSize: asset.byteSize, contentType: asset.contentType, correction: null, ...policy }));
    const recordPath = path.join(recordDir, `${cacheKey}.json`);
    try {
      const record = JSON.parse(await fs.readFile(recordPath, 'utf8'));
      const original = await fs.readFile(cachedFile(originalDir, record.sourceFile));
      const outputPath = cachedFile(derivedDir, record.outputFile);
      const output = await fs.readFile(outputPath);
      if (record.cacheKey !== cacheKey || original.length !== asset.byteSize || digest(original) !== record.sourceSha256 || output.length !== record.outputBytes || digest(output) !== record.outputSha256 || (asset.sha256 && record.sourceSha256 !== asset.sha256.toLowerCase())) throw new Error(`Media cache integrity mismatch: ${asset.id}`);
      return { ...record, sourcePath: cachedFile(originalDir, record.sourceFile), outputPath, cacheHit: true };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }

    const bytes = await download(asset, onProgress);
    const sourceSha256 = digest(bytes);
    const ext = path.posix.extname(asset.objectKey).slice(1).toLowerCase();
    const sourceFile = `${sourceSha256}.${/^[a-z0-9]{1,8}$/.test(ext) ? ext : 'bin'}`;
    const sourcePath = path.join(originalDir, sourceFile);
    await writeOriginal(sourcePath, bytes);
    const optimized = await optimize(bytes, asset);
    const outputSha256 = digest(optimized.bytes);
    const outputFile = `${outputSha256}.${optimized.format}`;
    const outputPath = path.join(derivedDir, outputFile);
    await writeOriginal(outputPath, optimized.bytes);
    const record = { cacheKey, sourceFile, outputFile, sourceSha256, outputSha256, sourceBytes: bytes.length, outputBytes: optimized.bytes.length, width: optimized.width, height: optimized.height, format: optimized.format, mode: optimized.mode, qualityEvidence: optimized.qualityEvidence, etag: asset.etag, ...policy };
    await writeOriginal(recordPath, Buffer.from(JSON.stringify(record, null, 2) + '\n'));
    return { ...record, sourcePath, outputPath, cacheHit: false };
  }

  async function worker() {
    try { while (!failed && index < input.length) {
      const i = index++;
      const asset = input[i];
      const identity = JSON.stringify([asset.objectKey, asset.etag, asset.byteSize, asset.contentType]);
      if (!active.has(identity)) active.set(identity, one(asset));
      const synced = await active.get(identity);
      if (asset.sha256 && synced.sourceSha256 !== asset.sha256.toLowerCase()) throw new Error(`Media SHA-256 changed: ${asset.id}`);
      result[i] = { ...synced, id: asset.id, objectKey: asset.objectKey, publicPaths: [...asset.publicPaths], ...(asset.correction ? {correction: asset.correction} : {}) };
    } } catch (error) { failed = true; throw error; }
  }
  const settled = await Promise.allSettled([worker(), worker()]);
  const failure = settled.find(x => x.status === 'rejected');
  if (failure) throw failure.reason;
  const unique = [...new Map(result.map(x => [x.outputFile, x])).values()];
  return { complete: true, ...(generation === undefined ? {} : { generation }), assets: result, summary: { inputAssets: result.length, uniqueOutputFiles: unique.length, sourceBytes: result.reduce((n,x) => n+x.sourceBytes,0), outputBytes: unique.reduce((n,x) => n+x.outputBytes,0), cacheHits: result.filter(x => x.cacheHit).length, historicalCorrections: result.filter(x => x.correction).length } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [manifestPath, cacheDir, catalogPath] = process.argv.slice(2);
  if (!manifestPath || !cacheDir || !catalogPath) throw new Error('Usage: node tools/sync-media.mjs manifest.json cache-directory catalog.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const catalog = await syncMedia({ assets: manifest.assets, cacheDir, generation: manifest.generation });
  await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
  console.log(JSON.stringify(catalog.summary));
}
