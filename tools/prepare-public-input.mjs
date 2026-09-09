import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const CORE_ROUTES = Object.freeze({ home: '/', about: '/about', bstvc: '/bstvc', research: '/research', publications: '/publications', resources: '/resources', news: '/news', journal: '/blogs' });
const TYPES = ['page', 'news', 'publication', 'journal', 'research', 'resource'];
const ENTRY_KEYS = 'id type slug title summary body date updated language href journal doi featured draft status seoTitle seoDescription createdAt updatedAt publishedAt releaseId sourcePath'.split(' ');
const LEGACY_KEYS = 'id type slug title date modified sourceUrl language headings contentHtml excerptHtml plainTextLength imageCount linkCount imageSources externalLinks'.split(' ');
const SETTINGS_KEYS = new Set(('browserTitle siteDescription siteName headerTagline headerLogoAssetId headerLogoUrl faviconAssetId faviconUrl faviconVersion defaultOgAssetId defaultOgUrl homeKicker homeTitle homeIntro homeHeroAssetId homeHeroUrl homeHeroAlt profileName profileRole profileImageAssetId profileImageUrl profileImageAlt homePrimaryLabel homePrimaryHref homeSecondaryLabel homeSecondaryHref homeUpdatesTitle homeUpdatesLabel homeUpdatesHref homeBackgroundMode homeBackgroundAssetId homeBackgroundUrl homeBackgroundPosterAssetId homeBackgroundPosterUrl homeBackgroundHtmlUrl homeBackgroundOpacity homeBackgroundFit homeBackgroundPosition brandPrimary brandSecondary footerName footerTagline footerNote institutionName institutionUrl heoaUrl scholarUrl orcidUrl researchGateUrl githubUrl xUrl bstvcWebsiteUrl bstvcDesktopUrl bstvcGithubUrl ' + Array.from({ length: 5 }, (_, index) => { const n = index + 1; return `homeCard${n}Title homeCard${n}Description homeCard${n}Href homeCard${n}Action homeCard${n}ImageAssetId homeCard${n}ImageUrl homePrinciple${n}Title homePrinciple${n}Description`; }).join(' ')).trim().split(/\s+/));
const RESERVED_PAGE_SLUGS = new Set(['blogs', 'archive', 'search', 'updates', 'pages', 'api', 'studio', 'cms-media', '_next', 'media', 'validation-preview']);
const PRIVATE_KEY = /^(?:__proto__|prototype|constructor|tables|original_?body(?:_?document)?|original_?html|body_?document|password(?:_?hash)?|salt|token|secret|studio_accounts_v1|updated_?by|revisions?|credentials?)$/i;

function fail(message) { throw new Error(`Invalid public export: ${message}`); }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); }
function keys(value, allowed, label, required = allowed) {
  object(value, label);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${label} has an unsupported field: ${key}`);
  for (const key of required) if (!Object.hasOwn(value, key)) fail(`${label}.${key} is required`);
}
function string(value, label, nonempty = false) { if (typeof value !== 'string' || (nonempty && !value.trim())) fail(`${label} must be ${nonempty ? 'a nonempty' : 'a'} string`); }
function array(value, label) { if (!Array.isArray(value)) fail(`${label} must be an array`); }
function strings(value, label) { array(value, label); for (const item of value) string(item, label, true); }
function timestamp(value, label, nullable = false) { if (nullable && value === null) return; string(value, label, true); if (!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) || !Number.isFinite(Date.parse(value))) fail(`${label} must be an ISO date`); }
function nullableString(value, label) { if (value !== null) string(value, label); }
function unique(values, label) { if (new Set(values).size !== values.length) fail(`${label} contains duplicates`); }
function sameStrings(actual, expected, label) { strings(actual, label); unique(actual, label); if (JSON.stringify([...actual].sort()) !== JSON.stringify([...expected].sort())) fail(`${label} does not match its public data`); }
function slug(value, label) {
  string(value, label, true);
  if (/[\s\/?#\\%\u0000-\u001f\u007f]/u.test(value) || value.startsWith('.') || /[.:]$/.test(value) || /[<>:"|*]/.test(value) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) fail(`${label} is not a portable route segment`);
}
function publicHref(value, label, nullable = false) {
  if (nullable && value === null) return;
  string(value, label, true);
  if (/[\s\\\u0000-\u001f\u007f]/u.test(value)) fail(`${label} contains unsafe URL characters`);
  if (/^\/(?!\/)/.test(value) || value.startsWith('#')) return;
  let url; try { url = new URL(value); } catch { fail(`${label} is not a public URL`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail(`${label} is not a public URL`);
}
function rejectPrivateKeys(value, label = 'export') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (PRIVATE_KEY.test(key)) fail(`${label} contains a non-public field: ${key}`);
    rejectPrivateKeys(child, `${label}.${key}`);
  }
}
export function entryRoute(entry) {
  if (entry.type === 'page') return Object.hasOwn(CORE_ROUTES, entry.slug) ? CORE_ROUTES[entry.slug] : `/${encodeURIComponent(entry.slug)}`;
  const prefix = { news: 'news', publication: 'publications', journal: 'blogs', research: 'research', resource: 'resources' }[entry.type];
  return `/${prefix}/${encodeURIComponent(entry.slug)}`;
}

/** Validate only the public-export contract. Full database snapshots are never accepted. */
export function validatePublicInput(input) {
  keys(input, ['formatVersion', 'rendererContractVersion', 'generation', 'data', 'migrated', 'manifest', 'assets'], 'export');
  if (input.formatVersion !== 1 || input.rendererContractVersion !== 1) fail('unsupported export or renderer contract version');
  string(input.generation, 'generation', true);
  rejectPrivateKeys(input);
  const { data, migrated, manifest } = input;
  keys(data, ['formatVersion', 'sourceExportedAt', 'lastUpdated', 'entries', 'settings', 'managedCorePages'], 'data');
  if (data.formatVersion !== 1) fail('unsupported data version');
  timestamp(data.sourceExportedAt, 'sourceExportedAt'); timestamp(data.lastUpdated, 'lastUpdated');
  sameStrings(data.managedCorePages, Object.keys(CORE_ROUTES), 'data.managedCorePages');
  array(data.entries, 'entries');
  for (const entry of data.entries) {
    keys(entry, ENTRY_KEYS, 'entry');
    if (!TYPES.includes(entry.type)) fail('unsupported entry type');
    slug(entry.slug, 'entry.slug');
    if (entry.type === 'page' && RESERVED_PAGE_SLUGS.has(entry.slug)) fail('page slug conflicts with a static application route');
    for (const field of ['id', 'title', 'releaseId']) string(entry[field], `entry.${field}`, true);
    if (!/^[A-Za-z0-9_-]+$/.test(entry.releaseId)) fail('entry.releaseId must be an opaque release identity');
    for (const field of ['summary', 'body']) string(entry[field], `entry.${field}`);
    if (entry.status !== 'published' || entry.draft !== false) fail('only explicitly published entries may be exported');
    if (!['en', 'zh'].includes(entry.language) || typeof entry.featured !== 'boolean') fail('invalid public entry language or featured value');
    for (const field of ['date', 'updated']) timestamp(entry[field], `entry.${field}`, true);
    for (const field of ['createdAt', 'updatedAt', 'publishedAt']) timestamp(entry[field], `entry.${field}`);
    for (const field of ['journal', 'doi', 'seoTitle', 'seoDescription']) nullableString(entry[field], `entry.${field}`);
    publicHref(entry.href, 'entry.href', true);
    if (entry.sourcePath !== `release:${entry.releaseId}`) fail('entry.sourcePath does not match its published release');
  }
  unique(data.entries.map(entry => entry.id), 'entry identities');
  unique(data.entries.map(entryRoute), 'public entry routes');
  object(data.settings, 'settings');
  for (const [key, value] of Object.entries(data.settings)) { if (!SETTINGS_KEYS.has(key)) fail(`unsupported public setting: ${key}`); string(value, `settings.${key}`); }
  // The endpoint sends normalized complete public settings. Missing keys must not silently revive defaults.
  sameStrings(Object.keys(data.settings), [...SETTINGS_KEYS], 'settings keys');

  keys(migrated, ['sourceSite', 'migratedAt', 'interfaceLanguage', 'contentLanguages', 'pages', 'posts'], 'migrated');
  publicHref(migrated.sourceSite, 'migrated.sourceSite'); timestamp(migrated.migratedAt, 'migrated.migratedAt');
  if (!['en', 'zh'].includes(migrated.interfaceLanguage)) fail('invalid migrated interface language');
  strings(migrated.contentLanguages, 'migrated.contentLanguages');
  if (migrated.contentLanguages.some(language => !['en', 'zh'].includes(language))) fail('invalid migrated content language');
  for (const collection of ['pages', 'posts']) {
    array(migrated[collection], `migrated.${collection}`);
    for (const item of migrated[collection]) {
      keys(item, LEGACY_KEYS, `migrated.${collection} item`); slug(item.slug, 'legacy slug');
      if (item.type !== (collection === 'pages' ? 'page' : 'post')) fail('invalid legacy entry type');
      if (!(typeof item.id === 'string' && item.id || Number.isSafeInteger(item.id) && item.id >= 0)) fail('invalid legacy entry identity');
      for (const field of ['title', 'contentHtml', 'excerptHtml']) string(item[field], `legacy.${field}`);
      for (const field of ['date', 'modified']) timestamp(item[field], `legacy.${field}`, true);
      if (!['en', 'zh'].includes(item.language)) fail('invalid legacy language');
      publicHref(item.sourceUrl, 'legacy.sourceUrl');
      for (const field of ['headings', 'imageSources', 'externalLinks']) { array(item[field], `legacy.${field}`); for (const value of item[field]) string(value, `legacy.${field}`); }
      for (const field of ['plainTextLength', 'imageCount', 'linkCount']) if (!Number.isSafeInteger(item[field]) || item[field] < 0) fail(`invalid legacy.${field}`);
    }
    unique(migrated[collection].map(item => item.slug), `legacy ${collection} slugs`);
  }
  const publishedBlogs = new Set(data.entries.filter(entry => entry.type === 'journal').map(entry => entry.slug));
  if (migrated.posts.some(post => publishedBlogs.has(post.slug))) fail('legacy blog duplicates a managed published route');

  keys(manifest, ['formatVersion', 'sourceExportedAt', 'entries', 'slugsByType', 'archivePages', 'legacyBlogs', 'managedCorePages', 'publishedCorePages'], 'manifest');
  if (manifest.formatVersion !== 1 || manifest.sourceExportedAt !== data.sourceExportedAt) fail('manifest generation does not match public data');
  array(manifest.entries, 'manifest.entries');
  const expectedEntries = data.entries.map(entry => ({ type: entry.type, slug: entry.slug, path: entryRoute(entry), releaseId: entry.releaseId }));
  for (const entry of manifest.entries) keys(entry, ['type', 'slug', 'path', 'releaseId'], 'manifest entry');
  const canonical = rows => rows.map(entry => JSON.stringify([entry.type, entry.slug, entry.path, entry.releaseId])).sort();
  if (JSON.stringify(canonical(manifest.entries)) !== JSON.stringify(canonical(expectedEntries))) fail('manifest entries do not match published entries');
  keys(manifest.slugsByType, TYPES, 'manifest.slugsByType');
  for (const type of TYPES) sameStrings(manifest.slugsByType[type], data.entries.filter(entry => entry.type === type).map(entry => entry.slug), `manifest.slugsByType.${type}`);
  sameStrings(manifest.archivePages, migrated.pages.map(page => page.slug), 'manifest.archivePages');
  sameStrings(manifest.legacyBlogs, migrated.posts.map(post => post.slug), 'manifest.legacyBlogs');
  sameStrings(manifest.managedCorePages, Object.keys(CORE_ROUTES), 'manifest.managedCorePages');
  sameStrings(manifest.publishedCorePages, data.entries.filter(entry => entry.type === 'page' && Object.hasOwn(CORE_ROUTES, entry.slug)).map(entry => entry.slug), 'manifest.publishedCorePages');
  array(input.assets, 'assets');
  return input;
}

export async function preparePublicInput({ inputPath, outputDir }) {
  const input = validatePublicInput(JSON.parse(await readFile(inputPath, 'utf8')));
  const template = await readFile(new URL('./static-cms-template.txt', import.meta.url), 'utf8');
  await mkdir(outputDir, { recursive: true });
  const files = { publicData: path.join(outputDir, 'public-data.json'), migratedContent: path.join(outputDir, 'migrated-content.json'), slugManifest: path.join(outputDir, 'slug-manifest.json'), cmsAdapter: path.join(outputDir, 'static-cms.ts') };
  for (const [name, value] of [['publicData', input.data], ['migratedContent', input.migrated], ['slugManifest', input.manifest]]) await writeFile(files[name], JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  await writeFile(files.cmsAdapter, template, { encoding: 'utf8', flag: 'wx' });
  return { files, counts: { entries: input.data.entries.length, archivePages: input.migrated.pages.length, legacyBlogs: input.migrated.posts.length }, manifest: input.manifest };
}
