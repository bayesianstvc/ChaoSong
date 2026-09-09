import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import os from 'node:os';
import sharp from 'sharp';
import { syncMedia, API_ORIGIN, knownMediaCorrection } from '../sync-media.mjs';


const base = await fs.mkdtemp(path.join(os.tmpdir(), 'chaosong-sync-media-test-'));
const sha = (x) => createHash('sha256').update(x).digest('hex');
const originalFetch = globalThis.fetch;
const pdf = Buffer.from('%PDF-1.4\n% Preserve text, outlines and annotations as original bytes.\n%%EOF');
function asset(bytes, overrides = {}) {
  return { id:'media_test',objectKey:'assets/media_test/example.pdf',downloadPath:'/cms-media/assets/media_test/example.pdf',etag:'"test-etag"',byteSize:bytes.length,contentType:'application/pdf',publicPaths:['/cms-media/assets/media_test','/media/example.pdf'],sha256:sha(bytes),...overrides };
}
function response(bytes, etag='"test-etag"', type='application/pdf') {
  return new Response(bytes,{status:200,headers:{etag,'content-type':type}});
}
async function withFetch(fn, run) {
  globalThis.fetch=fn;
  try { return await run(); } finally { globalThis.fetch=originalFetch; }
}

test('fixed host, exact object URL, no redirects/credentials; preserve PDF; cache reuse and generation', async()=>{
  let requests=0;
  await withFetch(async(url,options)=>{
    requests++;
    assert.equal(url,API_ORIGIN+'/cms-media/assets/media_test/example.pdf');
    assert.equal(options.headers['If-Match'],'"test-etag"');
    assert.equal(options.redirect,'error');
    assert.equal(options.credentials,'omit');
    assert.deepEqual(Object.keys(options.headers),['If-Match']);
    return response(pdf);
  },async()=>{
    const input={assets:[asset(pdf)],cacheDir:path.join(base,'pdf'),generation:'generation-1'};
    const result=await syncMedia(input);
    assert.equal(result.complete,true);assert.equal(result.generation,'generation-1');
    assert.equal(result.assets[0].mode,'original-preserved');
    assert.deepEqual(await fs.readFile(result.assets[0].outputPath),pdf);
    assert.deepEqual(await fs.readFile(result.assets[0].sourcePath),pdf);
    const again=await syncMedia({...input,generation:'generation-2'});
    assert.equal(again.assets[0].cacheHit,true);assert.equal(requests,1);
    assert.equal(again.generation,'generation-2');
    await fs.writeFile(again.assets[0].outputPath,Buffer.from('corrupted cache'));
    await assert.rejects(syncMedia(input),/cache integrity mismatch/);
    assert.equal(requests,1);
  });
});

test('scientific raster becomes smaller only with equal dimensions and identical decoded pixels',async()=>{
  const png=await sharp({create:{width:512,height:256,channels:4,background:'#3275a6'}}).png({compressionLevel:0}).toBuffer();
  const a=asset(png,{objectKey:'uploads/2026-09-10/scientific.png',downloadPath:'/cms-media/uploads/2026-09-10/scientific.png',contentType:'image/png'});
  await withFetch(async()=>response(png,'"test-etag"','image/png'),async()=>{
    const {assets:[r]}=await syncMedia({assets:[a],cacheDir:path.join(base,'image')});
    assert.equal(r.mode,'scientific-lossless-webp-original-dimensions');
    assert.equal(r.width,512);assert.equal(r.height,256);
    assert.equal(r.qualityEvidence.decodedPixelExact,true);
    assert.equal(r.outputBytes<r.sourceBytes,true);
    assert.deepEqual(await fs.readFile(r.sourcePath),png);
    assert.deepEqual(await sharp(png).ensureAlpha().raw().toBuffer(),await sharp(r.outputPath).ensureAlpha().raw().toBuffer());
  });
});

test('ETag, byte count and SHA changes all fail closed',async()=>{
  const cases=[
    ['etag',asset(pdf),()=>response(pdf,'"changed"'),/ETag changed/],
    ['bytes',asset(pdf,{byteSize:pdf.length+1}),()=>response(pdf),/byte size changed/],
    ['larger',asset(pdf,{byteSize:pdf.length-1}),()=>response(pdf),/larger than its manifest/],
    ['sha',asset(pdf,{sha256:'0'.repeat(64)}),()=>response(pdf),/SHA-256 changed/],
    ['redirect',asset(pdf),()=>new Response(null,{status:302,headers:{location:'https://example.com'}}),/HTTP 302/],
  ];
  for(const [name,a,make,error] of cases) await withFetch(async()=>make(),()=>assert.rejects(syncMedia({assets:[a],cacheDir:path.join(base,name)}),error));
});

test('foreign hosts, traversal, arbitrary routes and URL query are rejected before fetch',async()=>{
  await withFetch(async()=>{throw Error('Fetch must not run');},async()=>{
    await assert.rejects(syncMedia({assets:[asset(pdf)],cacheDir:path.join(base,'invalid'),apiOrigin:'https://example.com'}),/approved Sites origin/);
    for(const downloadPath of ['https://example.com/test','//example.com/test','/api/studio/export','/cms-media/assets/../password','/cms-media/assets/%2e%2e/password','/cms-media/assets/%252e%252e/password','/cms-media/assets/media_test/example.pdf?preview=1','/cms-media/assets/media_test/example.pdf#x']) {
      await assert.rejects(syncMedia({assets:[asset(pdf,{downloadPath})],cacheDir:path.join(base,'invalid')}));
    }
    await assert.rejects(syncMedia({assets:[asset(pdf,{objectKey:'assets/other/different.pdf'})],cacheDir:path.join(base,'invalid')}),/exact object key/);
  });
});

test('two workers maximum; duplicate object requests share immutable result',async()=>{
  let active=0,maxActive=0,requests=0;
  await withFetch(async()=>{
    requests++;active++;maxActive=Math.max(maxActive,active);
    await new Promise(resolve=>setTimeout(resolve,5));
    active--;return response(pdf);
  },async()=>{
    const a=asset(pdf);
    const assets=[a,{...a,id:'alias',publicPaths:['/alias.pdf']},...Array.from({length:3},(_,i)=>asset(pdf,{id:'other'+i,objectKey:`uploads/2026-09-10/${i}.pdf`,downloadPath:`/cms-media/uploads/2026-09-10/${i}.pdf`}))];
    const r=await syncMedia({assets,cacheDir:path.join(base,'concurrent')});
    assert.equal(r.assets.length,5);assert.equal(requests,4);assert.equal(maxActive,2);
    assert.equal(new Set(r.assets.map(x=>x.outputPath)).size,1);
    assert.deepEqual(r.assets[1].publicPaths,['/alias.pdf']);
  });
});

test('SVG vector bytes remain identical',async()=>{
  const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><text x="10" y="40">Scientific α β</text></svg>');
  const a=asset(svg,{objectKey:'assets/media_test/figure.svg',downloadPath:'/cms-media/assets/media_test/figure.svg',contentType:'image/svg+xml'});
  await withFetch(async()=>response(svg,'"test-etag"','image/svg+xml'),async()=>{
    const r=(await syncMedia({assets:[a],cacheDir:path.join(base,'svg')})).assets[0];
    assert.equal(r.mode,'original-preserved');assert.deepEqual(await fs.readFile(r.outputPath),svg);
  });
});

const historicalLink = {
  id:'media_legacy_0c0d2a783bf4c99b2a6f9a13',
  objectKey:'assets/media_legacy_0c0d2a783bf4c99b2a6f9a13/f290d022aa10-wechat.png',
  downloadPath:'/cms-media/assets/media_legacy_0c0d2a783bf4c99b2a6f9a13/f290d022aa10-wechat.png',
  etag:'"old-html-etag"',byteSize:222129,contentType:'image/png',
  publicPaths:['/media/f290d022aa10-wechat.png'],
  sha256:'0c0d2a783bf4c99b2a6f9a134ae12f6d90278993a069791d02f9d41cbb38ad42',
};
const currentPng = {
  id:'media_legacy_7ab7d311deaca0142d27eef3',
  objectKey:'assets/media_legacy_7ab7d311deaca0142d27eef3/36a43aa009d3-wechat.png',
  downloadPath:'/cms-media/assets/media_legacy_7ab7d311deaca0142d27eef3/36a43aa009d3-wechat.png',
  etag:'"current-png-etag"',byteSize:299785,contentType:'image/png',
  publicPaths:['/media/36a43aa009d3-wechat.png'],
  sha256:'7ab7d311deaca0142d27eef384550cfa5e87d982de4c51f8bc9131d73ca7bff0',
};

test('historical correction matches exact bad identity, hash, size and image type only',()=>{
  assert.equal(knownMediaCorrection(historicalLink)?.targetAssetId,currentPng.id);
  for(const patch of [{id:'other'},{objectKey:'assets/other.png'},{sha256:'0'.repeat(64)},{sha256:null},{byteSize:222130},{contentType:'text/html'}]) {
    assert.equal(knownMediaCorrection({...historicalLink,...patch}),null);
  }
  assert.equal(knownMediaCorrection(currentPng),null);
});

test('historical correction requires the exact PNG still in the current manifest; empty inputs cannot revive it',async()=>{
  await withFetch(async()=>{throw Error('Network must not run without the exact current target');},async()=>{
    await assert.rejects(syncMedia({assets:[historicalLink],cacheDir:path.join(base,'missing-target')}),/exact current published PNG/);
    for(const patch of [{id:'other'},{objectKey:'assets/other.png',downloadPath:'/cms-media/assets/other.png'},{sha256:'0'.repeat(64)},{byteSize:299786},{contentType:'image/jpeg'}]) {
      await assert.rejects(syncMedia({assets:[historicalLink,{...currentPng,...patch}],cacheDir:path.join(base,'missing-target')}),/exact current published PNG/);
    }
    const empty=await syncMedia({assets:[],cacheDir:path.join(base,'image'),generation:'after-deletion'});
    assert.deepEqual(empty.assets,[]);assert.equal(empty.summary.historicalCorrections,0);
    assert.equal(empty.generation,'after-deletion');
  });
});

test('corrected link downloads the current target once, checks its ETag, and never uses a local fallback',async()=>{
  let requests=0;
  await withFetch(async(url,options)=>{
    requests++;assert.equal(url,API_ORIGIN+currentPng.downloadPath);
    assert.equal(options.headers['If-Match'],currentPng.etag);
    return new Response(null,{status:412});
  },async()=>{
    await assert.rejects(syncMedia({assets:[historicalLink,currentPng],cacheDir:path.join(base,'target-current')}),/HTTP 412/);
    assert.equal(requests,1);
  });
  await withFetch(async(url)=>{
    assert.equal(url,API_ORIGIN+historicalLink.downloadPath);
    return new Response(null,{status:412});
  },async()=>{
    await assert.rejects(syncMedia({assets:[{...historicalLink,sha256:'1'.repeat(64)}],cacheDir:path.join(base,'new-original')}),/HTTP 412/);
  });
});

