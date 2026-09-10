import { readFile, writeFile, mkdir, readdir, cp, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { preparePublicInput } from './prepare-public-input.mjs';
import { selectMediaAliases } from './media-aliases.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.join(projectRoot, 'frontend');
const taskDir = path.join(projectRoot, '.build');
if (!process.env.PUBLIC_INPUT || !process.env.MEDIA_CATALOG) throw new Error('PUBLIC_INPUT and MEDIA_CATALOG are required');
const publicInputPath = path.resolve(process.env.PUBLIC_INPUT);
const mediaCatalogPath = path.resolve(process.env.MEDIA_CATALOG);
const basePath = process.env.STATIC_BASE_PATH ?? '';
if (basePath && !/^\/[a-zA-Z0-9_-]+$/.test(basePath)) throw new Error('Invalid static base path');
const stage = path.join(taskDir, 'build-' + new Date().toISOString().replace(/[:.]/g, '-'));
const slash = p => p.replaceAll('\\', '/');
const json = p => readFile(p, 'utf8').then(JSON.parse);
const write = async (p, value) => { await mkdir(path.dirname(p), { recursive: true }); await writeFile(p, value, 'utf8'); };
async function walk(dir) { const out = []; for (const entry of await readdir(dir, {withFileTypes: true})) { const p = path.join(dir, entry.name); if (entry.isDirectory()) out.push(...await walk(p)); else out.push(p); } return out; }

await mkdir(taskDir, {recursive:true});
await mkdir(stage); // Every attempt uses a new directory; no cleanup of retained builds.
const publicInput = await json(publicInputPath);
const publicData = await preparePublicInput({inputPath:publicInputPath, outputDir:path.join(stage,'data')});
const manifest = publicData.manifest;
const evidence = {generation:publicInput.generation, sourceExportedAt:publicInput.data.sourceExportedAt, rendererContractVersion:publicInput.rendererContractVersion, counts:publicData.counts};
await write(path.join(stage,'freshness.json'),JSON.stringify(evidence,null,2));
console.log('PUBLIC_GENERATION',JSON.stringify(evidence));

await cp(path.join(repoRoot,'app/(public)'),path.join(stage,'app/(public)'),{recursive:true});
for(const name of ['layout.tsx','globals.css']) await cp(path.join(repoRoot,'app',name),path.join(stage,'app',name));
const cssPath=path.join(stage,'app/globals.css');
await write(cssPath,(await readFile(cssPath,'utf8'))+'\n/* Static reader: preserve controls of authored galleries. */\n.source-prose .content-gallery-controls button { display: inline-flex !important; align-items: center; justify-content: center; }\n');
await cp(path.join(repoRoot,'components'),path.join(stage,'components'),{recursive:true});
await cp(path.join(repoRoot,'lib'),path.join(stage,'lib'),{recursive:true});
await write(path.join(stage,'lib/cms.ts'),"export * from '../data/static-cms';\n");
const pkg=await json(path.join(projectRoot,'package.json')); delete pkg.scripts;
await write(path.join(stage,'package.json'),JSON.stringify(pkg,null,2));
await write(path.join(stage,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx',moduleResolution:'bundler',module:'esnext',target:'es2022',allowImportingTsExtensions:true,paths:{'@/*':['./*']}}},null,2));
await cp(path.join(projectRoot,'postcss.config.mjs'),path.join(stage,'postcss.config.mjs'));

// Versioned design/legacy assets are local; fresh public CMS media takes precedence.
const staticCatalog=await json(process.env.STATIC_MEDIA_CATALOG ? path.resolve(process.env.STATIC_MEDIA_CATALOG) : path.join(repoRoot,'static-catalog.json'));
const liveCatalog=await json(mediaCatalogPath);
if (!Array.isArray(staticCatalog.assets) || !Array.isArray(liveCatalog.assets) || liveCatalog.complete === false) throw new Error('Invalid or incomplete media catalog');
if (liveCatalog.generation && liveCatalog.generation !== publicInput.generation) throw new Error('Media catalog generation mismatch');
const catalog=selectMediaAliases({
  staticAssets:staticCatalog.assets.map(asset=>({...asset,outputPath:asset.outputPath??path.join(repoRoot,'assets',asset.outputFile)})),
  liveAssets:liveCatalog.assets,
  publicInput,
});
const urlMap={};
await mkdir(path.join(stage,'public/media'),{recursive:true});
for(const asset of catalog.assets) {
  if(typeof asset.outputPath !== 'string' || !Array.isArray(asset.publicPaths)) throw new Error('Invalid catalog asset');
  const name=asset.outputFile??path.basename(asset.outputPath);
  if(!name || path.basename(name)!==name || /[\\/:]/.test(name)) throw new Error('Invalid catalog output filename');
  const rel='/media/'+name;
  await cp(asset.outputPath,path.join(stage,'public',rel));
  for(const url of asset.publicPaths) { if(typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) throw new Error('Invalid public asset alias'); urlMap[url]=basePath+rel; }
}
await write(path.join(stage,'media-catalog.json'),JSON.stringify(catalog,null,2));
const ordered=Object.keys(urlMap).sort((a,b)=>b.length-a.length);
const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const urlsRx=new RegExp(ordered.map(escapeRegex).join('|'),'g');
function rewriteAssets(source){source=source.replace(/https?:\/\/(?:homepage\.songchao-bstvc\.chatgpt\.site|chaosong\.heoa-group\.chatgpt\.site|(?:www\.)?chaosong\.blog)(?=\/)/g,(origin,offset,text)=>ordered.some(key=>text.startsWith(key,offset+origin.length))?'':origin);return ordered.length?source.replace(urlsRx,(match,offset,text)=>{
  // Do not rewrite part of another filename or an already-prefixed URL.
  if(basePath && text.slice(Math.max(0,offset-basePath.length),offset)===basePath)return match;
  const next=text[offset+match.length];if(next && /[\w./-]/.test(next))return match;
  return urlMap[match];
}):source;}
await write(path.join(stage,'asset-map.json'),JSON.stringify(urlMap,null,2));

const appPublic=path.join(stage,'app/(public)');
let layout=await readFile(path.join(appPublic,'layout.tsx'),'utf8');
layout=layout.replace('import { headers } from "next/headers";','').replace(/async function requestOrigin\(\) \{[^}]*\}/,'async function requestOrigin() { return "https://chaosong.blog/"; }').replace('import { SiteAnalytics } from "@/components/site-analytics";','').replace('<SiteAnalytics />','');
await write(path.join(appPublic,'layout.tsx'),layout);
await cp(path.join(repoRoot,'collection-templates'),appPublic,{recursive:true});
await write(path.join(stage,'components/static-redirect.tsx'),`"use client";\nimport {useEffect} from 'react';\nexport function StaticRedirect({href}:{href:string}) { const target=${JSON.stringify(basePath)}+href; useEffect(()=>{window.location.replace(target+window.location.search+window.location.hash);},[target]); return <><meta httpEquiv="refresh" content={'0;url='+target}/><p><a href={target}>Continue to the current page</a></p></>; }\n`);
for(const [route,target] of [['journal','/blogs'],['updates','/news']]) await write(path.join(appPublic,route,'page.tsx'),`import {StaticRedirect} from '@/components/static-redirect'; export default function Alias(){return <StaticRedirect href=${JSON.stringify(target)}/>;}\n`);
const legacyData=await json(publicData.files.migratedContent);
const legacyNews=legacyData.pages.find(x=>x.slug==='main-page')?.contentHtml??'';
const {extractNewsYears,extractNewsYearHtml}=await import(pathToFileURL(path.join(repoRoot,'lib/news-archive.ts')));
const actualYears=extractNewsYears(legacyNews).filter(year=>extractNewsYearHtml(legacyNews,year));

const routeParams={
  '[slug]':manifest.slugsByType.page.filter(x=>!manifest.managedCorePages.includes(x)),
  'blogs/[slug]':[...manifest.slugsByType.journal,...manifest.legacyBlogs],
  'archive/[slug]':manifest.archivePages,
  'news/[slug]':manifest.slugsByType.news,
  'publications/[slug]':manifest.slugsByType.publication,
  'resources/[slug]':manifest.slugsByType.resource,
  'research/[slug]':manifest.slugsByType.research,
  'pages/[slug]':manifest.slugsByType.page,
  'journal/[slug]':[...manifest.slugsByType.journal,...manifest.legacyBlogs],
  'news/archive/[year]':actualYears.map(String),
};
for(const [route,values] of Object.entries(routeParams)) {
  const p=path.join(appPublic,route,'page.tsx');let src=await readFile(p,'utf8');
  src=src.replace(/export const dynamic = ["']force-dynamic["'];?/g,'').replace(/export (?:async )?function generateStaticParams\(\) \{[\s\S]*?\n\}/g,'');
  if(route==='blogs/[slug]')src=src.replace('import { getEditorialEntries } from "@/lib/editorial";','');
  if(route==='journal/[slug]')src=`import {StaticRedirect} from '@/components/static-redirect'; export default async function Alias({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <StaticRedirect href={'/blogs/'+encodeURIComponent(decodeURIComponent(slug))}/>;}\n`;
  if(route==='pages/[slug]')src=src.replace('import { redirect } from "next/navigation";',"import {StaticRedirect} from '@/components/static-redirect';").replace('if (corePages[slug]) redirect(corePages[slug]);','if (corePages[slug]) return <StaticRedirect href={corePages[slug]}/>;');
  if(route==='news/archive/[year]')src=src.replace(/const complete = mergeCompleteHtml\([^;]*;/,'const complete = bundled;');
  const key=route.includes('[year]')?'year':'slug';
  src+='\nexport function generateStaticParams() { return '+JSON.stringify(values.map(v=>({[key]:v})))+'; }\n';
  await write(p,src);
}
let migrated=await readFile(path.join(stage,'components/migrated-page.tsx'),'utf8');
migrated=migrated.replace('getPublishedEntriesOrFallback, getPublishedEntryOrFallback','hasManagedCorePage, getPublishedEntriesOrFallback, getPublishedEntryOrFallback');
migrated=migrated.replace(/const completeHtml = [\s\S]*?\n  return \(/,'const completeHtml = managedSlug && hasManagedCorePage(managedSlug) ? managedHtml : bundledHtml;\n  return (');
migrated=migrated.replace('{completeHtml ? <SourceArticle item={item} html={completeHtml} /> : null}', '{completeHtml ? <SourceArticle item={item} html={completeHtml} /> : null}<p className="managed-label"><a href={'+JSON.stringify(basePath+'/archive/')+'+encodeURIComponent(slug)}>Open the preserved source archive ↗</a></p>');
await write(path.join(stage,'components/migrated-page.tsx'),migrated);
let publications=await readFile(path.join(appPublic,'publications/page.tsx'),'utf8');
publications=publications.replace('page && !page.sourcePath.startsWith("builtin:") ? page.html : source.contentHtml','page?.html ?? ""');
await write(path.join(appPublic,'publications/page.tsx'),publications);
let search=await readFile(path.join(stage,'components/search-client.tsx'),'utf8');
search=search.replace(/  useEffect\(\(\) => \{[\s\S]*?\n  \}, \[query\]\);/,'');
await write(path.join(stage,'components/search-client.tsx'),search);
let footer=await readFile(path.join(stage,'components/site-footer.tsx'),'utf8');
await write(path.join(stage,'components/site-footer.tsx'),footer.replace('href="/studio"','href="https://chaosong.heoa-group.chatgpt.site/studio"'));
let href=await readFile(path.join(stage,'lib/public-href.ts'),'utf8');
href=href.replace('const href = value.trim();','const raw = value.trim(); const base='+JSON.stringify(basePath)+'; const href = raw.startsWith("/") && !raw.startsWith("//") && !(base && (raw === base || raw.startsWith(base + "/"))) ? base + raw : raw;');
await write(path.join(stage,'lib/public-href.ts'),href);
let settings=await readFile(path.join(stage,'lib/site-settings.ts'),'utf8');
settings=settings.replace('return assetPattern.test(assetId) ? `/cms-media/assets/${encodeURIComponent(assetId)}` : safeUrl(fallbackUrl);','const resolved = assetPattern.test(assetId) ? `/cms-media/assets/${encodeURIComponent(assetId)}` : safeUrl(fallbackUrl); return STATIC_ASSET_MAP[resolved] ?? resolved;');
const selectedPublicSettings=(await json(publicData.files.publicData)).settings;
const settingsAssetKeys=new Set(Object.entries(selectedPublicSettings).filter(([key,value])=>key.endsWith('AssetId')&&value).map(([,value])=>'/cms-media/assets/'+value));
const settingsMap=Object.fromEntries(Object.entries(urlMap).filter(([key])=>settingsAssetKeys.has(key)));
settings='const STATIC_ASSET_MAP: Record<string,string> = '+JSON.stringify(settingsMap)+';\n'+settings;
await write(path.join(stage,'lib/site-settings.ts'),settings);
for(const p of [...await walk(path.join(stage,'app')),...await walk(path.join(stage,'components')),...await walk(path.join(stage,'lib')),...await walk(path.join(stage,'data'))]) {
  if(/\.(tsx?|css|json)$/.test(p)) {let source=await readFile(p,'utf8');if(!p.endsWith('site-settings.ts'))source=rewriteAssets(source);else {const index=source.indexOf('\n');source=source.slice(0,index)+rewriteAssets(source.slice(index));}if(p.includes(path.join('app','(public)')))source=source.replace(/canonical:\s*(["'`])\//g,(_,quote)=>'canonical: '+quote+basePath+'/');await write(p,source);}
}
let adapter=await readFile(publicData.files.cmsAdapter,'utf8');
adapter='const STATIC_URL_MAP: Record<string,string> = '+JSON.stringify(urlMap)+';\nfunction localizeHtml(html:string){return html.replace(/\\/cms-media\\/[^\\s"\'<>?]+/g, url => STATIC_URL_MAP[url] ?? url);}\n'+adapter.replace('html: markdownToHtml(entry.body)','html: localizeHtml(markdownToHtml(entry.body))');
await write(publicData.files.cmsAdapter,adapter);
// Imported public HTML may itself reference local media.
for(const p of await walk(path.join(stage,'public')))if(/\.(html|css|svg)$/.test(p))await write(p,rewriteAssets(await readFile(p,'utf8')));
await write(path.join(stage,'next.config.ts'),'export default '+JSON.stringify({output:'export',basePath,trailingSlash:true})+';\n');
await write(path.join(stage,'vite.config.ts'),`import {defineConfig} from 'vite';\nimport vinext from 'vinext';\nexport default defineConfig({plugins:[vinext()],resolve:{alias:[{find:'@/lib/cms',replacement:${JSON.stringify(slash(publicData.files.cmsAdapter))}},{find:'@',replacement:${JSON.stringify(slash(stage))}}]},build:{emptyOutDir:false},css:{postcss:${JSON.stringify(slash(stage))}}});\n`);
await write(path.join(stage,'build-context.json'),JSON.stringify({repoRoot,stage,basePath,sourceExportedAt:publicInput.data.sourceExportedAt,optimizedCatalog:catalog.assets.length>0,counts:publicData.counts},null,2));
await write(path.join(taskDir,'latest-build.json'),JSON.stringify({stage,basePath,generation:publicInput.generation},null,2));
console.log('STAGE',stage);
const child=spawn(process.execPath,[path.join(projectRoot,'node_modules/vinext/dist/cli.js'),'build'],{cwd:stage,stdio:['ignore','pipe','pipe'],env:{...process.env,NO_COLOR:'1'}});
let log='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{const text=chunk.toString();log+=text;process.stdout.write(text);});
const code=await new Promise(resolve=>child.on('exit',resolve));
await write(path.join(stage,'build.log'),log);
if(code!==0)throw new Error('Static build failed with exit '+code);
console.log('STATIC_BUILD_COMPLETE',stage);
