import {readFile,writeFile,readdir,mkdir,cp,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const taskDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.build');
const info=JSON.parse(await readFile(path.join(taskDir,'latest-build.json'),'utf8'));
const input=path.join(info.stage,'dist/client',info.basePath);
const output=path.join(info.stage,'site');
await mkdir(output); // Immutable candidate; never overwrite a reviewed directory.
async function walk(dir){const all=[];for(const item of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())all.push(...await walk(p));else all.push(p);}return all;}
const slash=p=>p.replaceAll('\\','/');
const files=(await walk(input)).map(full=>({full,rel:slash(path.relative(input,full))})).filter(f=>!f.rel.startsWith('validation-preview/'));
const selected=new Set(files.filter(f=>/(^|\/)index\.(html|txt)$/.test(f.rel)||f.rel.startsWith('_next/')).map(f=>f.rel));
const candidates=files.filter(f=>!selected.has(f.rel));
const textFiles=new Map();
for(const f of files)if(/\.(html|txt|js|css|json|svg)$/.test(f.rel))textFiles.set(f.rel,await readFile(f.full,'utf8'));
let changed=true;
while(changed){changed=false;const text=[...selected].map(k=>textFiles.get(k)??'').join('\n');for(const f of candidates)if(!selected.has(f.rel)&&(text.includes(info.basePath+'/'+f.rel)||text.includes('/'+f.rel))){selected.add(f.rel);changed=true;}}
const manifest=[];
for(const f of files.filter(f=>selected.has(f.rel))){const rel=f.rel.split('/').map(p=>{const decoded=decodeURIComponent(p);if(/[\\/]/.test(decoded)||decoded==='..')throw new Error('Unsafe exported path');return decoded;}).join('/');const dest=path.join(output,rel);await mkdir(path.dirname(dest),{recursive:true});await cp(f.full,dest);manifest.push({path:rel,bytes:(await stat(dest)).size});}
const fallback=path.join(info.stage,'dist/client/404.html');try{await cp(fallback,path.join(output,'404.html'));manifest.push({path:'404.html',bytes:(await stat(fallback)).size});}catch(e){if(e.code!=='ENOENT')throw e;}
await writeFile(path.join(output,'.nojekyll'),'','utf8');
manifest.push({path:'.nojekyll',bytes:0});
const htmls=manifest.filter(x=>x.path.endsWith('.html'));
const problems=[];
for(const file of htmls){const html=await readFile(path.join(output,file.path),'utf8');for(const match of html.matchAll(/\b(?:src|href|poster)=["']([^"']+)["']/g)){
 const raw=match[1].replaceAll('&amp;','&');if(!raw.startsWith('/')||raw.startsWith('//'))continue;
 let target=decodeURIComponent(raw.split(/[?#]/)[0]);
 if(info.basePath && !(target===info.basePath||target.startsWith(info.basePath+'/'))){problems.push({page:file.path,url:raw,reason:'missing base path'});continue;}
 target=target.slice(info.basePath.length)||'/';const dest=path.join(output,target);try{const s=await stat(dest);if(s.isDirectory())await stat(path.join(dest,'index.html'));}catch{problems.push({page:file.path,url:raw,reason:'missing static file'});}
 }
 if(/\b(?:src|poster)=["'][^"']*(?:chatgpt\.site|chaosong\.blog)/.test(html))problems.push({page:file.path,reason:'live source media dependency'});
 if(/(?:BACKUP_SITE_RESTORE|STUDIO_BACKUP_RESTORE_TOKEN|password_hash|"originalBody"|"bodyDocument"|\/api\/studio\/)/.test(html))problems.push({page:file.path,reason:'non-public marker'});
}
const report={createdAt:new Date().toISOString(),source:input,site:output,basePath:info.basePath,generation:info.generation,files:manifest.length,bytes:manifest.reduce((n,f)=>n+f.bytes,0),htmlPages:htmls.length,excludedUnreferencedFiles:files.length-selected.size,problems};
try{const catalog=JSON.parse(await readFile(path.join(info.stage,'media-catalog.json'),'utf8'));const chosen=new Map();for(const asset of catalog.assets)if(manifest.some(f=>f.path==='media/'+path.basename(asset.outputPath)))chosen.set(asset.sourceSha256,asset);const originals=[...chosen.values()].reduce((n,a)=>n+a.sourceBytes,0);const derivatives=[...chosen.values()].reduce((n,a)=>n+a.outputBytes,0);report.media={uniqueFiles:chosen.size,sourceBytes:originals,publishedBytes:derivatives,savedBytes:originals-derivatives,savedPercent:Number(((originals-derivatives)/originals*100).toFixed(2)),losslessOptimized:[...chosen.values()].filter(a=>a.mode!=='original-preserved').length,qualityPolicy:'Original dimensions, exact sRGB decoded pixels or original bytes; no lossy photo candidates published'};}catch(e){if(e.code!=='ENOENT')throw e;}
await writeFile(path.join(info.stage,'static-verification.json'),JSON.stringify(report,null,2)+'\n','utf8');
await writeFile(path.join(info.stage,'public-file-manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
if(problems.length){console.log(JSON.stringify(report,null,2));throw new Error('Static closure validation failed');}
await writeFile(path.join(taskDir,'latest-preview.json'),JSON.stringify({...info,site:output,report:path.join(info.stage,'static-verification.json')},null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
