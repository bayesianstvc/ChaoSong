import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStaticLinks } from '../static-link-validation.mjs';

const check = (html, overrides = {}) => validateStaticLinks({
  html, page: 'blogs/retained/index.html', basePath: '',
  filePaths: new Set(['index.html', 'blogs/retained/index.html', 'media/figure.webp', '_next/site.css']),
  ...overrides,
});

test('deleting a linked article removes its page without blocking the retained article', () => {
  const html = '<article><a href="/blogs/deleted/">Previous article</a><img src="/media/figure.webp"></article>';
  const before = check(html, { filePaths: new Set(['blogs/deleted/index.html', 'media/figure.webp']) });
  assert.deepEqual(before, { problems: [], warnings: [] });
  const after = check(html);
  assert.equal(after.problems.length, 0);
  assert.deepEqual(after.warnings, [{ page: 'blogs/retained/index.html', url: '/blogs/deleted/', tag: 'a', attribute: 'href', reason: 'missing navigation target' }]);
});

test('the same URL can be an anchor warning and a required-resource failure', () => {
  const result = check('<a href="/gone">Read</a><link href="/gone" rel="stylesheet"><script src="/gone"></script><img src="/gone"><video poster="/gone"></video>');
  assert.equal(result.warnings.length, 1);
  assert.deepEqual(result.problems.map(problem => [problem.tag, problem.attribute]), [['link', 'href'], ['script', 'src'], ['img', 'src'], ['video', 'poster']]);
});

test('attribute order, whitespace, quote style and tag case do not change classification', () => {
  const result = check(`<A title='Read > next' class="article" HREF = '/gone?x=1&amp;y=2#part'>Read</A>
    <link rel='stylesheet' media="screen" href = '/style.css'>
    <img alt='A > B' src = '/missing.png'>`);
  assert.equal(result.warnings[0].url, '/gone?x=1&y=2#part');
  assert.deepEqual(result.problems.map(problem => problem.url), ['/style.css', '/missing.png']);
});

test('unquoted URL attributes and numeric HTML entities retain resource checks', () => {
  const result = check('<a href=/gone>Read</a><img src=&#47;missing.png><link href=/missing.css rel=stylesheet>');
  assert.equal(result.warnings.length, 1);
  assert.deepEqual(result.problems.map(problem => problem.url), ['/missing.png', '/missing.css']);
});

test('comments, raw text, and data attributes do not create false resource references', () => {
  const result = check(`<!-- <img src="/gone"> --><script>const example = '<img src="/gone">';</script>
    <style>/* <a href='/gone'> */</style><textarea><img src='/gone'></textarea>
    <title>Example <img src='/gone'></title><a data-href='/gone' title="src='/gone'" href='/'>Home</a>`);
  assert.deepEqual(result, { problems: [], warnings: [] });
});

test('script src remains mandatory while its inline body is ignored', () => {
  const result = check('<script async src="/missing.js">"<a href=\'/gone\'>"</script>');
  assert.equal(result.problems.length, 1);
  assert.equal(result.problems[0].attribute, 'src');
  assert.equal(result.warnings.length, 0);
});

test('ordinary anchors still fail invalid or unsafe paths', () => {
  for (const url of ['/bad%ZZ', '/%2e%2e/private', '/safe/../private', '/safe/%5cprivate', '/%00private', '/%252e%252e/private', '/%2felsewhere']) {
    const result = check(`<a href="${url}">Read</a>`);
    assert.equal(result.problems.length, 1, url);
    assert.equal(result.warnings.length, 0, url);
  }
});

test('basePath violations remain errors for anchors as well as resources', () => {
  const result = check('<a href="/gone">Read</a><img src="/media/figure.webp"><a href="/ChaoSong/gone/">Old article</a><a href="/ChaoSong/">Home</a>', { basePath: '/ChaoSong' });
  assert.equal(result.problems.length, 2);
  assert.ok(result.problems.every(problem => problem.reason === 'missing base path'));
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].url, '/ChaoSong/gone/');
});

test('existing encoded routes, root paths and query strings resolve against the new candidate', () => {
  const result = check('<a href="/">Home</a><a href="/blogs/retained?x=1#part">Read</a><a href="/%E4%B8%AD%E6%96%87/">中文</a><img src="/media/figure.webp?v=2">', {
    filePaths: new Set(['index.html', 'blogs/retained/index.html', '中文/index.html', 'media/figure.webp']),
  });
  assert.deepEqual(result, { problems: [], warnings: [] });
});

test('download anchors remain mandatory resources', () => {
  const result = check('<a download href="/missing.pdf">Download</a><a href="/missing.pdf" download="paper.pdf">Download</a>');
  assert.equal(result.problems.length, 2);
  assert.equal(result.warnings.length, 0);
});

test('link href remains mandatory for every rel rather than being mistaken for article navigation', () => {
  const result = check('<link rel="stylesheet" href="/missing.css"><link href="/missing.ico" rel="icon"><link rel="modulepreload" href="/missing.js">');
  assert.equal(result.problems.length, 3);
  assert.equal(result.warnings.length, 0);
});

test('external URLs, fragments and first duplicate attributes keep their existing behavior', () => {
  const result = check('<a href="https://example.org/gone">External</a><a href="#section">Jump</a><a href="//example.org/gone">External</a><img src="/media/figure.webp" src="/gone"><a href="/" href="/gone">Home</a>');
  assert.deepEqual(result, { problems: [], warnings: [] });
});
