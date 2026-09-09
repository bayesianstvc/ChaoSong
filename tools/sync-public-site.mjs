import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {validatePublicInput} from './prepare-public-input.mjs';
import {syncMedia} from './sync-media.mjs';
import {syncStaticAssets} from './sync-static-assets.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const api='https://chaosong.heoa-group.chatgpt.site/api/public-export';
const live='https://bayesianstvc.github.io/ChaoSong/release.json';
const buildDir=path.join(root,'.build');
await mkdir(buildDir,{recursive:true});
async function getJson(url){
  const response=await fetch(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(60000),headers:{accept:'application/json'}});
  if(!response.ok)throw new Error(`Public request failed (${response.status})`);
  const bytes=await response.arrayBuffer();if(bytes.byteLength>8*1024*1024)throw new Error('Public manifest exceeded 8 MiB');
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function output(key,value){if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`${key}=${value}\n`);}
function run(script,env={}){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(root,'tools',script)],{cwd:root,env:{...process.env,...env},stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${script} failed (${code})`)));});}
const input=validatePublicInput(await getJson(api));
const generation=input.generation;
if(process.argv.includes('--verify-current')){
  const candidate=JSON.parse(await readFile(path.join(buildDir,'candidate-release.json'),'utf8'));
  if(candidate.generation!==generation)throw new Error('Sites was updated during this build; keep the previous publication and retry next run');
  console.log('PUBLIC_GENERATION_STILL_CURRENT',generation);process.exit(0);
}
const rendererRevision=process.env.GITHUB_SHA||'local-validation';
let previous=null;
try{previous=await getJson(live);}catch(error){console.log('Previous release metadata unavailable:',error.message);}
if(previous?.generation===generation&&previous?.rendererRevision===rendererRevision&&process.env.FORCE_SYNC!=='true'){
  console.log('UNCHANGED',generation);await output('changed','false');process.exit(0);
}
const inputPath=path.join(buildDir,`public-${generation}.json`);
await writeFile(inputPath,JSON.stringify(input));
console.log('PUBLIC_SNAPSHOT',JSON.stringify({generation,entries:input.data.entries.length,media:input.assets.length}));
const received=new Map(), mediaStarted=Date.now();
const progressTimer=setInterval(()=>console.log('MEDIA_PROGRESS',JSON.stringify({receivedBytes:[...received.values()].reduce((n,x)=>n+x.receivedBytes,0),completedDownloads:[...received.values()].filter(x=>x.receivedBytes===x.expectedBytes).length,totalAssets:input.assets.length,elapsedSeconds:Math.round((Date.now()-mediaStarted)/1000)})),30000);
let catalog;
try{catalog=await syncMedia({assets:input.assets,generation,cacheDir:path.join(root,'.cache','media'),onProgress:state=>received.set(state.id,state)});}finally{clearInterval(progressTimer);}
const catalogPath=path.join(buildDir,`media-${generation}.json`);
await writeFile(catalogPath,JSON.stringify(catalog));
console.log('MEDIA',JSON.stringify(catalog.summary));
const bundledCatalog=JSON.parse(await readFile(path.join(root,'frontend','static-catalog.json'),'utf8'));
const staticCatalog=await syncStaticAssets({staticAssets:bundledCatalog.assets,liveAssets:catalog.assets,publicInput:input,cacheDir:path.join(root,'.cache','static')});
const staticCatalogPath=path.join(buildDir,`static-${generation}.json`);
await writeFile(staticCatalogPath,JSON.stringify(staticCatalog));
console.log('STATIC_ASSETS',JSON.stringify(staticCatalog.summary));
if(process.argv.includes('--media-only')){console.log('MEDIA_READY',catalogPath);process.exit(0);}
await run('build-static.mjs',{PUBLIC_INPUT:inputPath,MEDIA_CATALOG:catalogPath,STATIC_MEDIA_CATALOG:staticCatalogPath});
await run('finalize-static.mjs');
const candidate=JSON.parse(await readFile(path.join(buildDir,'latest-preview.json'),'utf8'));
const report=JSON.parse(await readFile(candidate.report,'utf8'));
if(report.problems.length||report.bytes>800_000_000)throw new Error('Candidate violates validation or 800 MB publication budget');
const latest=validatePublicInput(await getJson(api));
if(latest.generation!==generation)throw new Error('Source changed while building; previous publication retained');
const release={formatVersion:1,generation,rendererRevision,publishedAt:new Date().toISOString(),sourceUpdatedAt:input.data.lastUpdated,entries:input.data.entries.length,bytes:report.bytes,files:report.files+1,mediaCorrections:catalog.assets.filter(asset=>asset.correction).map(asset=>({assetId:asset.id,correction:asset.correction.id,sourceSha256:asset.correction.badSha256,publishedSha256:asset.sourceSha256}))};
for(let i=0;i<8;i++){const total=report.bytes+Buffer.byteLength(JSON.stringify(release,null,2)+'\n');if(total===release.bytes)break;release.bytes=total;}
await writeFile(path.join(candidate.site,'release.json'),JSON.stringify(release,null,2)+'\n');
await writeFile(path.join(buildDir,'candidate-release.json'),JSON.stringify(release,null,2)+'\n');
await output('changed','true');await output('artifact_path',candidate.site);
console.log('CANDIDATE_READY',JSON.stringify(release));
