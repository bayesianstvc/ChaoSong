import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublishedFollowPage, refinePublishedArticleHtml, splitBilingualHeading } from '../../frontend/lib/public-article-presentation.ts';

const followSlug = 'follow-bstvc-bstvc-2026-11-18-9e9c32';
const profile = 'https://www.researchgate.net/profile/Chao-Song-19';
const legacy = 'https://www.researchgate.net/profile/Chao_Song15';
const options = { hasPublishedFollow: true, researchGateUrl: profile };
const page = (slug, language = 'en') => ({ type: 'page', slug, language });

test('published Follow aliases stay on the mounted site and keep query, fragment and link attributes', () => {
  assert.equal(isPublishedFollowPage(page(followSlug)), true);
  assert.equal(isPublishedFollowPage({ type: 'post', slug: followSlug }), false);
  const oldPath = `/pages/${followSlug}/?via=v2&amp;mode=qr#contact`;
  const external = `https://example.com/pages/${followSlug}/`;
  const original = `<p><a title="a > b" HREF = 'https://chaosong.heoa-group.chatgpt.site${oldPath}' rel="noopener">Follow</a> <a href="${external}">External</a></p>`;
  const target = `/ChaoSong/${followSlug}/?via=v2&amp;mode=qr#contact`;
  assert.equal(refinePublishedArticleHtml(original, page('bstvc-v2'), { ...options, basePath: '/ChaoSong' }),
    original.replace(`https://chaosong.heoa-group.chatgpt.site${oldPath}`, target));
  assert.equal(refinePublishedArticleHtml(original, page('bstvc-v2'), { ...options, hasPublishedFollow: false }), original);
  assert.equal(refinePublishedArticleHtml(`<a href=/pages/${followSlug}>Follow</a>`, page('bstvc-v2'), options), `<a href=/${followSlug}/>Follow</a>`);
});

test('updates only known ResearchGate URLs on About and Publications with published profile setting', () => {
  const original = `<a href="${legacy}" target="_blank"><img src="/media/rg.webp" alt="RG"></a><a href="https://www.researchgate.net/profile/Another-Researcher">Collaborator</a>`;
  const patched = original.replace(legacy, profile);
  assert.equal(refinePublishedArticleHtml(original, page('about'), options), patched);
  assert.equal(refinePublishedArticleHtml(original, page('publications'), options), patched);
  assert.equal(refinePublishedArticleHtml(original, page('journal-archive'), options), original);
  assert.equal(refinePublishedArticleHtml(original, page('about'), { ...options, researchGateUrl: 'https://example.com/profile' }), original);
});

test('promotes exact headings, retaining IDs, inline formatting and page boundaries', () => {
  const original = '<p id="topic-1"><strong>TOPIC I:</strong> Methods</p><details><summary>Appendix</summary><p><strong>TOPIC II：</strong> Data</p></details><div data-page-break="true"></div><p class="content-gallery-caption"><strong>TOPIC III: Caption</strong></p><p><strong>TOPIC IV: Endnote</strong></p>';
  const expected = '<h2 id="topic-1"><strong>TOPIC I:</strong> Methods</h2><details><summary>Appendix</summary><h2><strong>TOPIC II：</strong> Data</h2></details><div data-page-break="true"></div><p class="content-gallery-caption"><strong>TOPIC III: Caption</strong></p><p><strong>TOPIC IV: Endnote</strong></p>';
  assert.equal(refinePublishedArticleHtml(original, page('publications'), options), expected);
  const about = '<h1 id="academic-links"><strong>Academic Links</strong></h1><div data-page-break="true"></div><h1><strong>Chao Song</strong> / <strong>宋超</strong></h1><h1>Related People:</h1>';
  assert.equal(refinePublishedArticleHtml(about, page('about'), options), about.replaceAll('<h1', '<h2').replaceAll('</h1>', '</h2>'));
});

test('tags Chinese reading blocks without modifying explicit language, galleries, linked images or formulas', () => {
  const formula = '<span class="katex"><math><annotation encoding="application/x-tex">x_1&amp;y_2</annotation></math><span aria-hidden="true">x₁</span></span>';
  const image = '<figure data-content-gallery="true" data-gallery-order="3,1,2"><a href="/paper/2"><img src="/media/2.webp" loading="lazy" alt="Image 2"></a><img src="/media/1.webp" alt="Image 1"><figcaption>Research showcase</figcaption></figure>';
  const protectedMarkup = `<p lang="en">欢迎访问这里的研究项目</p><div lang="fr"><p>欢迎访问这里的研究项目</p></div><pre><code>&lt;span&gt;欢迎访问这里的研究项目&lt;/span&gt;</code></pre><p>${formula}</p><template><a href="/pages/${followSlug}">Inert</a></template>`;
  const original = `<p>English introduction</p><p class="article-copy"><strong>欢迎查看我们的研究动态</strong> ${formula}</p>` + image + protectedMarkup;
  const expected = original.replace('<p class="article-copy">','<p class="article-copy" lang="zh">');
  assert.equal(refinePublishedArticleHtml(original, page('journal-2026'), options), expected);
  assert.equal(refinePublishedArticleHtml(expected, page('journal-2026'), options), expected);
  assert.equal(refinePublishedArticleHtml(original, page('journal-2026', 'zh'), options), original);
});

test('marks each language of plainly separated bilingual headings without changing their display text or authored language', () => {
  const original = '<h2 id="channels">English channels &middot; 英文平台</h2><h2>中文平台 · Chinese channels</h2><h3>Follow BSTVC | 关注 BSTVC</h3><h2 lang="en">English channels · 英文平台</h2><h2>Topic I · Topic II</h2><h2>中文速读</h2>';
  const expected = '<h2 id="channels"><span lang="en">English channels</span> &middot; <span lang="zh">英文平台</span></h2><h2><span lang="zh">中文平台</span> · <span lang="en">Chinese channels</span></h2><h3><span lang="en">Follow BSTVC</span> | <span lang="zh">关注 BSTVC</span></h3><h2 lang="en">English channels · 英文平台</h2><h2>Topic I · Topic II</h2><h2 lang="zh">中文速读</h2>';
  assert.equal(refinePublishedArticleHtml(original, page(followSlug), options), expected);
  assert.equal(refinePublishedArticleHtml(expected, page(followSlug), options), expected);
  assert.deepEqual(splitBilingualHeading('Follow BSTVC | 关注 BSTVC'), { before:'Follow BSTVC', divider:' | ', after:'关注 BSTVC', beforeLang:'en', afterLang:'zh' });
  assert.equal(splitBilingualHeading('BSTVC · Advanced modeling'), null);
  assert.equal(splitBilingualHeading('小节·现象'), null);
});
