import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// The shared TOC owns the two-column layout. Nesting it in the obsolete
// 190px outer rail collapsed generic-page prose to zero width on desktop.
test('managed pages give the shared reading layout one full-width outer track', async () => {
  const css = await readFile(new URL('../../frontend/app/globals.css', import.meta.url), 'utf8');
  const component = await readFile(new URL('../../frontend/components/managed-content.tsx', import.meta.url), 'utf8');
  assert.match(component, /<OriginalContentToc\s/);
  const rule = css.match(/\.managed-content\s*\{([^}]+)\}/)?.[1];
  assert.ok(rule, 'managed page layout rule exists');
  assert.match(rule, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/);
  assert.doesNotMatch(rule, /grid-template-columns:\s*190px/);
});
