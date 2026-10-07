// Reviewed V34 output additions. Metadata is derived only from published public input.
const core = { home: '/', about: '/about', bstvc: '/bstvc', research: '/research', publications: '/publications', resources: '/resources', news: '/news', journal: '/blogs' };
const prefix = { news: 'news', publication: 'publications', journal: 'blogs', research: 'research', resource: 'resources' };
export function publicEntryPath(entry) {
  return entry.type === 'page' ? (Object.hasOwn(core, entry.slug) ? core[entry.slug] : `/${encodeURIComponent(entry.slug)}`) : `/${prefix[entry.type]}/${encodeURIComponent(entry.slug)}`;
}
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
// Self-contained so the static CMS adapter can reuse this exact route resolver.
export function getRouteMetadataInfo(pagePath, publicData, migrated = {pages: []}) {
  const trim = value => value.replace(/\/+$/, '') || '/';
  const route = entry => {
    const core = {home:'/',about:'/about',bstvc:'/bstvc',research:'/research',publications:'/publications',resources:'/resources',news:'/news',journal:'/blogs'};
    const prefix = {news:'news',publication:'publications',journal:'blogs',research:'research',resource:'resources'};
    return entry.type === 'page' ? (Object.hasOwn(core,entry.slug)?core[entry.slug]:'/'+encodeURIComponent(entry.slug)) : '/'+prefix[entry.type]+'/'+encodeURIComponent(entry.slug);
  };
  const page = trim(pagePath), name = publicData.settings?.siteName || 'Chao Song';
  const entry = publicData.entries.find(value => trim(route(value)) === page);
  if (entry) return {title:entry.seoTitle?.trim() || entry.title,description:entry.seoDescription?.trim() || entry.summary,path:route(entry),type:entry.type==='page'?'website':'article'};
  if (page === '/search') return {title:`Search | ${name}`,description:`Search ${name}'s research, publications, news, resources and bilingual archive.`,path:'/search',type:'website',robots:{index:false,follow:true}};
  if (page === '/archive') return {title:`Source Archive | ${name}`,description:'Preserved public source pages in their original order and language.',path:'/archive',type:'website'};
  if (!page.startsWith('/archive/')) return null;
  let slug;try{slug=decodeURIComponent(page.slice('/archive/'.length));}catch{return null;}
  const archived = migrated.pages.find(value=>value.slug===slug);
  if (!archived) return null;
  const description = archived.headings?.filter(Boolean).slice(0,4).join(' · ') || `${archived.title} — preserved source page in its original language.`;
  return {title:`${archived.title} | Source Archive`,description,path:'/archive/'+encodeURIComponent(archived.slug),type:'article'};
}
export function applyStaticMetadata(html, relativePath, publicData, basePath = '', migrated = {pages: []}) {
  const pagePath = '/' + relativePath.replace(/(?:^|\/)index\.html$/, '');
  const info = getRouteMetadataInfo(pagePath, publicData, migrated);
  if (!info) return html;
  const {title,description} = info;
  const canonical = `https://chaosong.blog${basePath}${info.path.replace(/\/$/, '')}/`;
  // Remove only the inherited document metadata, never article text, Gallery or executable assets.
  return html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, head => {
    head = head.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
      .replace(/<meta\b[^>]*(?:name|property)=["'](?:description|og:title|og:description|og:url|twitter:title|twitter:description)["'][^>]*>/gi, '')
      .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '');
    const tags = `<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><link rel="canonical" href="${escape(canonical)}">`;
    return head.replace(/<\/head>/i, tags + '</head>');
  });
}

export function appendVisitorCollector(html, collectorScript) {
  if (html.includes('id="chao-v34-visitor"')) return html;
  // Collector is reviewed code, never user-authored HTML; literal '<' is escaped for script parsing.
  const script = `<script id="chao-v34-visitor">${collectorScript.replace(/<\/script/gi, '<\\/script')}</script>`;
  return html.replace(/<\/body>/i, script + '</body>');
}

export const visitorScript = "(function collectVisitorPage(endpoint        , pathname         ) {\n  if (!/^https:\\/\\/(chaosong\\.blog|chaosong\\.heoa-group\\.chatgpt\\.site)$/.test(location.origin)) return;\n  const state = window                                                                                         ;\n  if (state.__chaoVisitBootstrap) { state.__chaoVisitBootstrap(pathname); return; }\n  function record(path = location.pathname) {\n    if (state.__chaoVisitPath === path) return;\n    state.__chaoVisitPath = path;\n    if (/^\\/(studio|api|_next|assets|media|cms-media)(\\/|$)/i.test(path) || /\\.(png|jpe?g|gif|webp|avif|svg|ico|pdf|zip|mp4|webm|mp3|css|js|json|xml|txt|woff2?|map|wasm)$/i.test(path)) return;\n  const day = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);\n  let visitorId                = null;\n  try {\n    const key = \"chao-visitor-day-v34\";\n    const saved = JSON.parse(localStorage.getItem(key) || \"null\");\n    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;\n    visitorId = saved?.day === day && typeof saved.id === \"string\" && uuid.test(saved.id) ? saved.id : crypto.randomUUID();\n    localStorage.setItem(key, JSON.stringify({ day, id: visitorId }));\n  } catch { visitorId = null; }\n  // Discard path, query, credentials and fragments before anything leaves the browser.\n  let referrer = \"\";\n  try {\n    const url = new URL(document.referrer), host = url.hostname;\n    if (/^https?:$/.test(url.protocol) && !/^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(host) && !host.includes(\":\") && host !== \"localhost\" && !host.endsWith(\".localhost\")) referrer = url.origin;\n  } catch { /* direct navigation or unusable referrer */ }\n  // Never use sendBeacon here: the cross-origin collector must omit authentication cookies.\n  const body = JSON.stringify({ eventId: crypto.randomUUID(), path, day, visitorId, referrer });\n  const send = () => fetch(endpoint, { method: \"POST\", mode: \"cors\", credentials: \"omit\", headers: { \"content-type\": \"application/json\" }, body, keepalive: true });\n  void send().then(response => { if (response.status >= 500) setTimeout(() => { void send().catch(() => {}); }, 1500); }).catch(() => {});\n  }\n  state.__chaoVisitBootstrap = record;\n  // Install once for both serialized static bootstraps and React route effects.\n  // Query/hash edits keep the same pathname and therefore do not add page views.\n  const onNavigate = () => { try { record(); } catch { /* Analytics must never break navigation. */ } };\n  window.addEventListener(\"popstate\", onNavigate);\n  window.addEventListener(\"pageshow\", onNavigate);\n  for (const method of [\"pushState\", \"replaceState\"]         ) {\n    const original = window.history[method];\n    window.history[method] = function (               ...args                                    ) {\n      const result = original.apply(this, args);\n      onNavigate();\n      return result;\n    };\n  }\n  record(pathname);\n})(\"https://chaosong.heoa-group.chatgpt.site/api/analytics/collect\");";
