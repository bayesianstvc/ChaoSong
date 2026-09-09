const CMS_PREFIX = '/cms-media/';
const STATIC_EXACT = new Set(['/favicon.png', '/og.png', '/bstvc-logo-motion.html']);
const isStaticPath = value => STATIC_EXACT.has(value) || /^\/(?:design|profile|media)\//.test(value);
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function mentions(text, alias) {
  // An alias must not match a longer filename or child object key.
  return new RegExp(escapeRegex(alias) + '(?![\\w./%~-])').test(text);
}

function requiredCmsAliases(input) {
  const text = JSON.stringify([input.data, input.migrated]);
  const required = new Set();
  for (const match of text.matchAll(/\basset:([A-Za-z0-9_-]+)/g)) required.add(`${CMS_PREFIX}assets/${match[1]}`);
  for (const match of text.matchAll(/\/cms-media\/[^\s"'<>?\\\[\](){},;]+/g)) required.add(match[0]);
  for (const [key, value] of Object.entries(input.data?.settings ?? {})) {
    if (key.endsWith('AssetId') && value) required.add(`${CMS_PREFIX}assets/${value}`);
  }
  return required;
}

/**
 * The live publication owns every /cms-media alias. Bundled historical media
 * can supply only explicit public archive references, never a missing current
 * CMS object or a stale current /media alias associated with such an object.
 * This function is pure; callers still check file bytes and build closure.
 */
export function selectMediaAliases({ staticAssets, liveAssets, publicInput }) {
  if (!Array.isArray(staticAssets) || !Array.isArray(liveAssets) || !publicInput?.data || !publicInput?.migrated) throw new Error('Public media inputs are required');
  const liveAliases = new Map();
  for (const asset of liveAssets) {
    if (!Array.isArray(asset.publicPaths)) throw new Error('Live media aliases are required');
    for (const alias of asset.publicPaths) {
      if (typeof alias !== 'string' || !alias.startsWith('/') || alias.startsWith('//')) throw new Error('Invalid live media alias');
      const old = liveAliases.get(alias);
      if (old && (old.outputFile ?? old.outputPath) !== (asset.outputFile ?? asset.outputPath)) throw new Error(`Conflicting live media alias: ${alias}`);
      liveAliases.set(alias, asset);
    }
  }
  for (const alias of requiredCmsAliases(publicInput)) {
    if (!liveAliases.has(alias)) throw new Error(`Published CMS media alias is missing from the live catalog: ${alias}`);
  }
  const currentText = JSON.stringify(publicInput.data);
  const archiveText = JSON.stringify(publicInput.migrated);
  const selected = [];
  for (const asset of staticAssets) {
    if (!Array.isArray(asset.publicPaths)) throw new Error('Static media aliases are required');
    const linkedToCms = asset.publicPaths.some(alias => typeof alias === 'string' && alias.startsWith(CMS_PREFIX));
    const aliases = asset.publicPaths.filter(alias => {
      if (typeof alias !== 'string') throw new Error('Invalid static media alias');
      if (alias.startsWith(CMS_PREFIX) || liveAliases.has(alias)) return false;
      if (!isStaticPath(alias)) throw new Error(`Unrecognized bundled public asset path: ${alias}`);
      if (!alias.startsWith('/media/')) return true;
      const inCurrent = mentions(currentText, alias);
      const inArchive = mentions(archiveText, alias);
      if (linkedToCms && inCurrent) throw new Error(`Current public legacy media alias is missing from the live catalog: ${alias}`);
      // Keep deliberately published archive media. Once the archive reference is
      // absent from the public snapshot, its old local alias is removed as well.
      return inArchive || (!linkedToCms && inCurrent);
    });
    if (aliases.length) selected.push({ ...asset, publicPaths: aliases });
  }
  return { assets: [...selected, ...liveAssets] };
}
