import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePublicInput, entryRoute, CORE_ROUTES } from '../prepare-public-input.mjs';
const settingNames = ["browserTitle","siteDescription","siteName","headerTagline","headerLogoAssetId","headerLogoUrl","faviconAssetId","faviconUrl","faviconVersion","defaultOgAssetId","defaultOgUrl","homeKicker","homeTitle","homeIntro","homeHeroAssetId","homeHeroUrl","homeHeroAlt","profileName","profileRole","profileImageAssetId","profileImageUrl","profileImageAlt","homePrimaryLabel","homePrimaryHref","homeSecondaryLabel","homeSecondaryHref","homeUpdatesTitle","homeUpdatesLabel","homeUpdatesHref","homeBackgroundMode","homeBackgroundAssetId","homeBackgroundUrl","homeBackgroundPosterAssetId","homeBackgroundPosterUrl","homeBackgroundHtmlUrl","homeBackgroundOpacity","homeBackgroundFit","homeBackgroundPosition","brandPrimary","brandSecondary","homeCard1Title","homeCard1Description","homeCard1Href","homeCard1Action","homeCard1ImageAssetId","homeCard1ImageUrl","homeCard2Title","homeCard2Description","homeCard2Href","homeCard2Action","homeCard2ImageAssetId","homeCard2ImageUrl","homeCard3Title","homeCard3Description","homeCard3Href","homeCard3Action","homeCard3ImageAssetId","homeCard3ImageUrl","homeCard4Title","homeCard4Description","homeCard4Href","homeCard4Action","homeCard4ImageAssetId","homeCard4ImageUrl","homeCard5Title","homeCard5Description","homeCard5Href","homeCard5Action","homeCard5ImageAssetId","homeCard5ImageUrl","homePrinciple1Title","homePrinciple1Description","homePrinciple2Title","homePrinciple2Description","homePrinciple3Title","homePrinciple3Description","homePrinciple4Title","homePrinciple4Description","homePrinciple5Title","homePrinciple5Description","footerName","footerTagline","footerNote","institutionName","institutionUrl","heoaUrl","scholarUrl","orcidUrl","researchGateUrl","githubUrl","xUrl","bstvcWebsiteUrl","bstvcDesktopUrl","bstvcGithubUrl"];

const date = '2026-09-10T00:00:00.000Z';
function fixture(body = 'Published only') {
  const entry = { id: 'journal:sample', type: 'journal', slug: 'sample', title: 'Sample', summary: '', body, date: null, updated: null, language: 'en', href: null, journal: null, doi: null, featured: false, draft: false, status: 'published', seoTitle: null, seoDescription: null, createdAt: date, updatedAt: date, publishedAt: date, releaseId: 'release_sample', sourcePath: 'release:release_sample' };
  const core = Object.keys(CORE_ROUTES);
  const manifest = { formatVersion: 1, sourceExportedAt: date, entries: [{ type: entry.type, slug: entry.slug, path: entryRoute(entry), releaseId: entry.releaseId }], slugsByType: { page: [], news: [], publication: [], journal: ['sample'], research: [], resource: [] }, archivePages: [], legacyBlogs: [], managedCorePages: core, publishedCorePages: [] };
  return { formatVersion: 1, rendererContractVersion: 1, generation: 'generation_sample', data: { formatVersion: 1, sourceExportedAt: date, lastUpdated: date, entries: [entry], settings: Object.fromEntries(settingNames.map(key => [key, ''])), managedCorePages: core }, migrated: { sourceSite: 'https://example.test/', migratedAt: date, interfaceLanguage: 'en', contentLanguages: ['en', 'zh'], pages: [], posts: [] }, manifest, assets: [] };
}
function rejects(mutate) { const input = fixture(); mutate(input); assert.throws(() => validatePublicInput(input), /Invalid public export/); }

test('preserves deliberately empty published body and current authored formatting', () => {
  for (const body of ['', ':::gallery {layout="carousel"}\n![figure](asset:media_example)\n:::\n\n$$\\beta(s,t)$$\n\n| A | B |\n|---|---|\n| 1 | 2 |\n<div data-page-break="true"></div>']) {
    const input = fixture(body); assert.equal(validatePublicInput(input).data.entries[0].body, body);
  }
});
test('rejects full database input and nested private fields instead of stripping them', () => {
  assert.throws(() => validatePublicInput({ tables: { cms_entries: [] } }), /Invalid public export/);
  for (const key of ['originalBody', 'bodyDocument', 'updatedBy', 'password_hash']) rejects(input => { input.data.entries[0][key] = 'DO_NOT_EXPORT'; });
  rejects(input => { input.data.settings.studio_accounts_v1 = 'DO_NOT_EXPORT'; });
  rejects(input => { input.assets.push({ nested: { password_hash: 'DO_NOT_EXPORT' } }); });
});
test('requires an explicit released publication, with no current-row or seed fallback', () => {
  for (const status of ['draft', 'archived']) rejects(input => { input.data.entries[0].status = status; });
  rejects(input => { input.data.entries[0].draft = true; });
  for (const releaseId of [null, '', ' ', '../release']) rejects(input => { input.data.entries[0].releaseId = releaseId; });
  rejects(input => { input.data.entries[0].sourcePath = 'builtin:sample'; });
  rejects(input => { input.data.entries[0].publishedAt = null; });
});
test('missing required fields and unsupported contract versions fail closed', () => {
  for (const key of ['data', 'manifest', 'assets', 'generation']) rejects(input => { delete input[key]; });
  for (const key of ['body', 'status', 'releaseId', 'summary']) rejects(input => { delete input.data.entries[0][key]; });
  rejects(input => { input.rendererContractVersion = 2; });
  rejects(input => { input.generation = ''; });
  rejects(input => { delete input.data.settings.siteName; });
});
test('rejects unsafe portable route segments and reserved page collisions', () => {
  for (const name of ['..', '../studio', '%2e%2e', 'a/b', 'a\\b', 'a?b', 'a#b', 'CON', ' a', 'a:']) rejects(input => { input.data.entries[0].slug = name; });
  rejects(input => { input.data.entries[0].type = 'page'; input.data.entries[0].slug = 'api'; });
  rejects(input => { input.data.entries[0].href = 'javascript:alert(1)'; });
  rejects(input => { input.data.entries[0].href = 'https://name:secret@example.test/'; });
  assert.equal(entryRoute({ type: 'journal', slug: '第一篇博文' }), '/blogs/%E7%AC%AC%E4%B8%80%E7%AF%87%E5%8D%9A%E6%96%87');
  assert.equal(entryRoute({ type: 'page', slug: 'toString' }), '/toString');
});
test('cross-validates manifest route, release, slug sets and snapshot generation', () => {
  rejects(input => { input.manifest.entries[0].releaseId = 'release_other'; });
  rejects(input => { input.manifest.entries[0].path = '/studio'; });
  rejects(input => { input.manifest.entries = []; });
  rejects(input => { input.manifest.slugsByType.journal.push('ghost'); });
  rejects(input => { input.manifest.archivePages.push('ghost'); });
  rejects(input => { input.manifest.sourceExportedAt = '2025-01-01T00:00:00.000Z'; });
  rejects(input => { input.data.entries.push({ ...input.data.entries[0] }); });
});
test('all fixed managed core identities survive absent or removed CMS entries', () => {
  const input = fixture(); assert.deepEqual(validatePublicInput(input).data.managedCorePages, Object.keys(CORE_ROUTES));
  rejects(value => { value.data.managedCorePages = ['home']; });
  rejects(value => { value.manifest.managedCorePages = ['home']; });
});
