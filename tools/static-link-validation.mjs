// Inspect generated HTML without conflating document navigation with resources.
// Only a missing ordinary anchor target is recoverable. Invalid paths and all
// resource references remain publication errors, even when URLs are identical.
function decodeAttribute(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi, entity => {
    const name = entity.slice(1, -1).toLowerCase();
    if (name.startsWith('#')) {
      const code = name[1] === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
    }
    return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }[name];
  });
}

function* references(html) {
  const tags = /<!--[\s\S]*?-->|<(\/?)([a-z][\w:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi;
  let rawText = null;
  for (const match of html.matchAll(tags)) {
    if (!match[2]) continue;
    const tag = match[2].toLowerCase();
    if (rawText) {
      if (match[1] && tag === rawText) rawText = null;
      continue;
    }
    if (match[1]) continue;
    if (['script', 'style', 'textarea', 'title'].includes(tag)) rawText = tag;
    const attributes = new Map();
    const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    for (const attribute of match[3].matchAll(pattern)) {
      const name = attribute[1].toLowerCase();
      // HTML uses the first occurrence of a duplicate attribute.
      if (!attributes.has(name)) attributes.set(name, decodeAttribute(attribute[2] ?? attribute[3] ?? attribute[4] ?? ''));
    }
    for (const attribute of ['src', 'href', 'poster']) {
      if (attributes.has(attribute)) yield { tag, attribute, url: attributes.get(attribute), navigation: tag === 'a' && attribute === 'href' && !attributes.has('download') };
    }
  }
}

/** Pure closure check. filePaths contains decoded, relative published filenames. */
export function validateStaticLinks({ html, page, basePath = '', filePaths }) {
  const available = filePaths instanceof Set ? filePaths : new Set(filePaths);
  const problems = [];
  const warnings = [];
  for (const reference of references(html)) {
    const { url, navigation, tag, attribute } = reference;
    if (!url.startsWith('/') || url.startsWith('//')) continue;
    const issue = reason => ({ page, url, tag, attribute, reason });
    let target;
    try { target = decodeURIComponent(url.split(/[?#]/)[0]); }
    catch { problems.push(issue('invalid URL encoding')); continue; }
    if (/[\\\x00-\x1f\x7f]/.test(target) || target.startsWith('//') || /%[0-9a-f]{2}/i.test(target) || target.split('/').some(segment => segment === '.' || segment === '..')) {
      problems.push(issue('unsafe static path')); continue;
    }
    if (basePath && !(target === basePath || target.startsWith(basePath + '/'))) {
      problems.push(issue('missing base path')); continue;
    }
    const relative = target.slice(basePath.length).replace(/^\/+/, '');
    const index = relative ? relative.replace(/\/$/, '') + '/index.html' : 'index.html';
    if (available.has(relative) || available.has(index)) continue;
    (navigation ? warnings : problems).push(issue(navigation ? 'missing navigation target' : 'missing static file'));
  }
  return { problems, warnings };
}
