import test from 'node:test';
import assert from 'node:assert/strict';
import {selectMediaAliases} from '../media-aliases.mjs';

const cms='/cms-media/assets/media_test';
const legacy='/media/legacy.jpg';
const old={outputFile:'old.jpg',outputPath:'/cache/old.jpg',publicPaths:[cms,legacy]};
const fresh={outputFile:'fresh.jpg',outputPath:'/cache/fresh.jpg',publicPaths:[cms,legacy]};
const input=(body='',history='')=>({data:{entries:[{body}],settings:{}},migrated:{pages:[{contentHtml:history}],posts:[]}});
const select=(data,live=[],bundled=[old])=>selectMediaAliases({staticAssets:bundled,liveAssets:live,publicInput:data}).assets;

test('missing live asset token fails even when its bytes exist in the old catalog',()=>{
  assert.throws(()=>select(input('![image](asset:media_test)')),/missing from the live catalog/);
});
test('direct CMS reference with preview query requires the live exact object alias',()=>{
  assert.throws(()=>select(input(`<img src="${cms}?preview=1&width=1280">`)),/missing from the live catalog/);
  assert.deepEqual(select(input(`<img src="${cms}?preview=1&width=1280">`),[fresh]),[fresh]);
});
test('media asset selected by public settings cannot fall back to bundled bytes',()=>{
  const value=input();value.data.settings.profileImageAssetId='media_test';
  assert.throws(()=>select(value),/missing from the live catalog/);
});
test('CMS-associated /media legacy reference in current content fails without live alias',()=>{
  assert.throws(()=>select(input(`![image](${legacy})`)),/Current public legacy media alias/);
  // An explicit archive also using the URL must not make the current fallback legal.
  assert.throws(()=>select(input(`![image](${legacy})`,`<img src="${legacy}">`)),/Current public legacy media alias/);
});
test('explicit historical archive keeps its own legacy image without exposing CMS aliases',()=>{
  const assets=select(input('',`<img src="${legacy}">`));
  assert.equal(assets.length,1);assert.deepEqual(assets[0].publicPaths,[legacy]);
});
test('removed archive reference removes the old local alias and file candidate',()=>{
  assert.deepEqual(select(input()),[]);
});
test('fresh live alias wins over both current and historical old bytes',()=>{
  const assets=select(input(`![image](${legacy})`,`<img src="${legacy}">`),[fresh]);
  assert.deepEqual(assets,[fresh]);
});
test('fixed design assets and independently public legacy media remain available',()=>{
  const design={outputFile:'design.webp',publicPaths:['/design/card.webp']};
  const independent={outputFile:'independent.png',publicPaths:['/media/independent.png']};
  assert.deepEqual(select(input('![q](/media/independent.png)'),[],[design,independent]),[design,independent]);
});
test('filename prefixes cannot falsely retain an unreferenced historical asset',()=>{
  assert.deepEqual(select(input('',`<img src="${legacy}.other">`)),[]);
});
