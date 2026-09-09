import katex from "katex";

const MEDIA_SIZES = new Set(["small", "medium", "large", "full"]);
const MEDIA_ALIGNS = new Set(["left", "center", "right"]);

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'");
}

function safeHref(value: string) {
  return /^(https?:\/\/|mailto:|\/|#)/i.test(value) ? value : "#";
}

function renderMath(value: string, displayMode: boolean) {
  try {
    return katex.renderToString(value, { displayMode, throwOnError: true, output: "html" });
  } catch {
    return `<code class="math-error">${escapeHtml(value)}</code>`;
  }
}

function mediaSource(value: string) {
  const match = value.match(/^asset:([a-zA-Z0-9_-]+)$/);
  return match ? { href: `/cms-media/assets/${match[1]}`, assetId: match[1] } : { href: safeHref(value), assetId: "" };
}

function blockAttribute(value: string | undefined, name: string) {
  const normalized = value?.replace(/&quot;/gi, '"').replace(/&#0?39;/gi, "'");
  const match = normalized?.match(new RegExp(`(?:^|\\s)${name}=(?:"([^"]*)"|'([^']*)'|([^\\s}]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
}

function mediaSize(value: string | undefined) {
  return value && MEDIA_SIZES.has(value) ? value : "medium";
}

function mediaAlign(value: string | undefined) {
  return value && MEDIA_ALIGNS.has(value) ? value : "center";
}

function renderInline(value: string) {
  return escapeHtml(value)
    .replace(/\{\{style size=(small|normal|large|xlarge) color=(#[0-9a-f]{6})\}\}([\s\S]*?)\{\{\/style\}\}/gi, (_match, size, color, text) => `<span class="content-text-style content-text-${size}" data-text-style="true" data-text-size="${size}" data-text-color="${color}" style="color:${color}">${text}</span>`)
    .replace(/@\[(PDF|VIDEO):([^\]]*)\]\(([^)]+)\)(?:\{([^}]*)\})?/gi, (_match, kind, label, src, attrs) => {
      const source = mediaSource(src);
      const safe = escapeHtml(source.href);
      const safeLabel = escapeHtml(String(label).trim() || (kind.toUpperCase() === "PDF" ? "PDF" : "Video"));
      const asset = source.assetId ? ` data-asset-id="${escapeHtml(source.assetId)}"` : "";
      const posterSource = blockAttribute(attrs, "poster");
      const poster = posterSource ? mediaSource(posterSource) : null;
      const posterAttributes = poster ? ` poster="${escapeHtml(poster.href)}"${poster.assetId ? ` data-poster-asset-id="${escapeHtml(poster.assetId)}"` : ""}` : "";
      const size = mediaSize(blockAttribute(attrs, "width"));
      const align = mediaAlign(blockAttribute(attrs, "align"));
      const figureAttributes = ` class="content-embed content-${kind.toLowerCase()} content-media-${size} content-align-${align}" data-size="${size}" data-align="${align}"${asset}`;
      const elementAttributes = ` data-size="${size}" data-align="${align}"${asset}`;
      return kind.toUpperCase() === "PDF"
        ? `<figure${figureAttributes}><iframe src="${safe}" title="${safeLabel}" loading="lazy"${elementAttributes}></iframe><figcaption>${safeLabel}</figcaption></figure>`
        : `<figure${figureAttributes}><video src="${safe}" controls playsinline preload="metadata"${elementAttributes}${posterAttributes}><track kind="captions" src="data:text/vtt,WEBVTT" srcLang="en" label="Captions" /></video><figcaption>${safeLabel}</figcaption></figure>`;
    })
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+(?:&quot;([\s\S]*?)&quot;|&#039;([\s\S]*?)&#039;))?\)(?:\{([^}]*)\})?/g, (_match, alt, src, doubleTitle, singleTitle, attrs) => {
      const source = mediaSource(src);
      const safeAlt = escapeHtml(alt);
      const title = doubleTitle ?? singleTitle;
      const safeTitle = title ? ` title="${escapeHtml(title)}"` : "";
      const normalizedSize = mediaSize(blockAttribute(attrs, "width"));
      const previewWidth = normalizedSize === "small" ? 640 : normalizedSize === "medium" ? 960 : 1280;
      const imageHref = source.assetId ? `${source.href}?preview=1&width=${previewWidth}` : source.href;
      const safe = escapeHtml(imageHref);
      const align = mediaAlign(blockAttribute(attrs, "align"));
      const figureNumber = blockAttribute(attrs, "figure").replace(/[^a-zA-Z0-9._-]/g, "");
      const figureLabel = blockAttribute(attrs, "label").replace(/[^a-zA-Z0-9._-]/g, "");
      const figureSource = blockAttribute(attrs, "source");
      const asset = source.assetId ? ` data-asset-id="${escapeHtml(source.assetId)}"` : "";
      const researchAttrs = `${figureNumber ? ` data-figure-number="${escapeHtml(figureNumber)}"` : ""}${figureLabel ? ` data-figure-label="${escapeHtml(figureLabel)}"` : ""}${figureSource ? ` data-figure-source="${escapeHtml(figureSource)}"` : ""}`;
      const caption = title || figureNumber || figureSource
        ? `<figcaption>${figureNumber ? `<span class="content-figure-number">Figure ${escapeHtml(figureNumber)}.</span> ` : ""}${title ? escapeHtml(title) : ""}${figureSource ? `<small>Source: ${escapeHtml(figureSource)}</small>` : ""}</figcaption>`
        : "";
      return `<figure class="content-image content-image-${normalizedSize} content-align-${align}${figureNumber || figureLabel ? " content-research-figure" : ""}" data-align="${align}"${figureLabel ? ` id="${escapeHtml(figureLabel)}"` : ""}${asset}${researchAttrs}><img src="${safe}" alt="${safeAlt}" loading="lazy" data-size="${normalizedSize}" data-align="${align}"${asset}${researchAttrs}${safeTitle} />${caption}</figure>`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)(?:\{target=(_blank|_self)\})?/g, (_match, label, href, target) => {
      const safe = escapeHtml(safeHref(href));
      const targetAttributes = target === "_blank" ? ' target="_blank" rel="noreferrer"' : "";
      const crossReference = /^#(?:fig|table|eq)-[a-zA-Z0-9._-]+$/.test(href) ? ` class="content-cross-reference" data-reference-label="${escapeHtml(href.slice(1))}"` : "";
      return `<a href="${safe}"${crossReference}${targetAttributes}>${label}</a>`;
    })
    .replace(/\[@([^\]]+)\]/g, '<cite class="citation" data-cite="$1">[$1]</cite>')
    .replace(/\[\^([^\]]+)\]/g, '<sup class="footnote-ref"><a href="#fn-$1" id="fnref-$1">$1</a></sup>')
    .replace(/\$([^$\n]+)\$/g, (_match, expression) => `<studio-math-inline class="math-inline" role="math" aria-label="${escapeHtml(expression)}">${renderMath(expression, false)}</studio-math-inline>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\+\+([^+]+)\+\+/g, "<u>$1</u>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function isTableDivider(value: string) {
  return /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(value);
}

function tableCells(value: string) {
  return value.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

export function markdownToHtml(markdown: string) {
  const footnotes = new Map<string, string>();
  const sourceLines = markdown.replace(/\r\n/g, "\n").split("\n");
  const lines = sourceLines.filter((line) => {
    const definition = line.match(/^\[\^([^\]]+)\]:\s*(.+)$/);
    if (!definition) return true;
    footnotes.set(definition[1], definition[2]);
    return false;
  });
  const output: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let ordered = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    const tag = ordered ? "ol" : "ul";
    output.push(`<${tag}>${list.map((item) => `<li>${renderInline(item)}</li>`).join("")}</${tag}>`);
    list = [];
    ordered = false;
  };
  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^<!--\s*pagebreak\s*-->$/i.test(line)) {
      flush();
      output.push('<div class="article-page-break" data-page-break="true" role="separator" aria-label="Public page break"><span>Public page break</span></div>');
      continue;
    }
    if (line.startsWith("```")) {
      flush();
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) { code.push(lines[index]); index += 1; }
      output.push(`<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    const columnsDirective = line.match(/^:::columns(?:\s+\{([^}]*)\})?$/i);
    if (columnsDirective) {
      flush();
      const columnLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^:::endcolumns\s*$/i.test(lines[index].trim())) {
        columnLines.push(lines[index]);
        index += 1;
      }
      const columns: string[][] = [];
      let current: string[] = [];
      for (const columnLine of columnLines) {
        if (/^:::column\s*$/i.test(columnLine.trim())) {
          if (current.length) columns.push(current);
          current = [];
        } else {
          current.push(columnLine);
        }
      }
      if (current.length) columns.push(current);
      const ratioValue = blockAttribute(columnsDirective[1], "ratio");
      const ratio = /^(?:1:1|2:1|1:2)$/.test(ratioValue) ? ratioValue : "1:1";
      const rendered = columns.slice(0, 2).map((column) => `<studio-column>${markdownToHtml(column.join("\n").trim())}</studio-column>`).join("");
      output.push(`<studio-columns class="content-columns" data-ratio="${ratio}" role="group" aria-label="Two-column content">${rendered}</studio-columns>`);
      continue;
    }
    if (/^:::(info|note|warning|success|citation)$/i.test(line)) {
      flush();
      const kind = line.slice(3).toLowerCase();
      const content: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== ":::") { content.push(lines[index]); index += 1; }
      output.push(`<aside class="content-callout content-callout-${kind}">${content.map((part) => renderInline(part)).join("<br />")}</aside>`);
      continue;
    }
    const tableDirective = line.match(/^:::table(?:\s+\{([^}]*)\})?$/i);
    if (tableDirective) {
      flush();
      const tableLines: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== ":::") { if (lines[index].trim()) tableLines.push(lines[index]); index += 1; }
      const hasHeader = blockAttribute(tableDirective[1], "header") !== "false";
      const parsedRows = tableLines.filter((row) => row.includes("|") && !isTableDivider(row.trim())).map((row) => tableCells(row.trim()));
      const header = hasHeader ? parsedRows[0] ?? [] : [];
      const rows = hasHeader ? parsedRows.slice(1) : parsedRows;
      const number = blockAttribute(tableDirective[1], "number").replace(/[^a-zA-Z0-9._-]/g, "");
      const caption = blockAttribute(tableDirective[1], "caption");
      const label = blockAttribute(tableDirective[1], "label").replace(/[^a-zA-Z0-9._-]/g, "");
      const source = blockAttribute(tableDirective[1], "source");
      const notes = blockAttribute(tableDirective[1], "notes");
      const alignments = blockAttribute(tableDirective[1], "align").split(",").map((value) => /^(?:left|center|right)$/.test(value) ? value : "left");
      const horizontalScroll = blockAttribute(tableDirective[1], "scroll") !== "false";
      const downloadCsv = blockAttribute(tableDirective[1], "download") !== "false";
      const width = Math.max(header.length, ...rows.map((row) => row.length), 0);
      const allRows = hasHeader ? [header, ...rows] : rows;
      const cell = (value: string, cellIndex: number, tag: "th" | "td") => `<${tag} style="text-align:${alignments[cellIndex] ?? "left"}">${renderInline(value)}</${tag}>`;
      const table = width ? `<div class="content-table-wrap${horizontalScroll ? "" : " no-scroll"}"><table>${hasHeader ? `<thead><tr>${Array.from({ length: width }, (_, cellIndex) => cell(header[cellIndex] ?? "", cellIndex, "th")).join("")}</tr></thead>` : ""}<tbody>${rows.map((row) => `<tr>${Array.from({ length: width }, (_, cellIndex) => cell(row[cellIndex] ?? "", cellIndex, "td")).join("")}</tr>`).join("")}</tbody></table></div>` : "";
      const csv = allRows.map((row) => row.map((value) => /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value).join(",")).join("\n");
      const attributes = `${number ? ` data-table-number="${escapeHtml(number)}"` : ""}${caption ? ` data-table-caption="${escapeHtml(caption)}"` : ""}${label ? ` data-table-label="${escapeHtml(label)}"` : ""}${source ? ` data-table-source="${escapeHtml(source)}"` : ""}${notes ? ` data-table-notes="${escapeHtml(notes)}"` : ""} data-table-alignments="${escapeHtml(alignments.join(","))}" data-table-header="${hasHeader}" data-table-scroll="${horizontalScroll}" data-table-download="${downloadCsv}"`;
      output.push(`<figure class="content-table-figure"${label ? ` id="${escapeHtml(label)}"` : ""}${attributes}>${table}${number || caption ? `<figcaption>${number ? `<span>Table ${escapeHtml(number)}.</span> ` : ""}${escapeHtml(caption)}</figcaption>` : ""}${source ? `<small class="content-table-source">Source: ${escapeHtml(source)}</small>` : ""}${notes ? `<small class="content-table-notes">Notes: ${escapeHtml(notes)}</small>` : ""}${downloadCsv && csv ? `<a class="content-table-download" href="data:text/csv;charset=utf-8,${encodeURIComponent(csv)}" download="${escapeHtml(label || "table")}.csv">Download CSV</a>` : ""}</figure>`);
      continue;
    }
    const galleryDirective = line.match(/^:::gallery(?:\s+\{([^}]*)\})?$/i);
    if (galleryDirective) {
      flush();
      const gallery: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== ":::") { if (lines[index].trim()) gallery.push(renderInline(lines[index].trim())); index += 1; }
      const count = gallery.length;
      const layout = blockAttribute(galleryDirective[1], "layout") === "grid" ? "grid" : "carousel";
      const size = mediaSize(blockAttribute(galleryDirective[1], "size") || "medium");
      const frameValue = blockAttribute(galleryDirective[1], "frame");
      const frame = frameValue === "tall" || frameValue === "standard" ? frameValue : "compact";
      const autoplay = blockAttribute(galleryDirective[1], "autoplay") === "true";
      const interval = Math.max(3, Math.min(15, Number(blockAttribute(galleryDirective[1], "interval")) || 5));
      const caption = blockAttribute(galleryDirective[1], "caption");
      const controls = layout === "carousel" ? `<div class="content-gallery-controls" contenteditable="false"><button type="button" data-gallery-prev aria-label="Previous image">←</button><span data-gallery-status>1 / ${count}</span><button type="button" data-gallery-next aria-label="Next image">→</button><button type="button" data-gallery-fullscreen aria-label="Open slideshow fullscreen">⛶</button></div>` : "";
      output.push(`<section class="content-gallery content-gallery-${layout}${layout === "carousel" ? " content-slideshow" : ""}" data-gallery data-gallery-layout="${layout}" data-gallery-size="${size}" data-gallery-frame="${frame}" data-gallery-autoplay="${autoplay}" data-gallery-interval="${interval}"${caption ? ` data-gallery-caption="${escapeHtml(caption)}"` : ""} tabindex="0" aria-label="Image gallery"><div class="content-gallery-track">${gallery.join("")}</div>${caption ? `<p class="content-gallery-caption">${escapeHtml(caption)}</p>` : ""}${controls}</section>`);
      continue;
    }
    const equationDirective = line.match(/^\$\$(?:\s+\{([^}]*)\})?$/);
    if (equationDirective) {
      flush();
      const formula: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== "$$") {
        formula.push(lines[index]);
        index += 1;
      }
      const expression = formula.join("\n").trim();
      const number = blockAttribute(equationDirective[1], "number").replace(/[^a-zA-Z0-9._-]/g, "");
      const label = blockAttribute(equationDirective[1], "label").replace(/[^a-zA-Z0-9_-]/g, "");
      output.push(`<div class="math-display${number ? " math-display-numbered" : ""}" role="math" aria-label="${escapeHtml(expression)}"${number ? ` data-equation-number="${escapeHtml(number)}"` : ""}${label ? ` data-equation-label="${escapeHtml(label)}" id="${escapeHtml(label)}"` : ""}><span>${renderMath(expression, true)}</span>${number ? `<a class="math-equation-number" href="#${escapeHtml(label || `equation-${number}`)}" aria-label="Equation ${escapeHtml(number)}">(${escapeHtml(number)})</a>` : ""}</div>`);
      continue;
    }
    if (/^@\[(?:PDF|VIDEO):[^\]]*\]\([^)]+\)(?:\{[^}]*\})?$/i.test(line) || /^!\[[^\]]*\]\([^)]+\)(?:\{[^}]*\})?$/.test(line)) {
      flush();
      output.push(renderInline(line));
      continue;
    }
    if (index + 1 < lines.length && line.includes("|") && isTableDivider(lines[index + 1].trim())) {
      flush();
      const header = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index].trim()));
        index += 1;
      }
      index -= 1;
      output.push(`<div class="content-table-wrap"><table><thead><tr>${header.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${header.map((_, cellIndex) => `<td>${renderInline(row[cellIndex] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }
    const unorderedItem = line.match(/^[-*]\s+(.+)$/);
    const orderedItem = line.match(/^\d+[.)]\s+(.+)$/);
    if (unorderedItem || orderedItem) {
      flushParagraph();
      const nextOrdered = Boolean(orderedItem);
      if (list.length && ordered !== nextOrdered) flushList();
      ordered = nextOrdered;
      list.push((orderedItem ?? unorderedItem)![1]);
      continue;
    }
    if (line.startsWith("> ")) {
      flush();
      output.push(`<blockquote><p>${renderInline(line.slice(2))}</p></blockquote>`);
      continue;
    }
    if (/^---+$/.test(line)) {
      flush();
      output.push("<hr />");
      continue;
    }
    paragraph.push(line);
  }

  flush();
  if (footnotes.size) {
    output.push(`<section class="footnotes" aria-label="Footnotes"><ol>${[...footnotes.entries()].map(([id, text]) => `<li id="fn-${escapeHtml(id)}">${renderInline(text)} <a href="#fnref-${escapeHtml(id)}" aria-label="Back to reference">↩</a></li>`).join("")}</ol></section>`);
  }
  return output.join("\n");
}

function attribute(value: string, name: string) {
  const match = value.match(new RegExp(`(?:^|\\s)${name}=["']([^"']*)["']`, "i"));
  return match?.[1] ?? "";
}

function plainText(value: string) {
  return decodeEntities(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").trim());
}

function inlineHtmlToMarkdown(value: string): string {
  return decodeEntities(value)
    .replace(/<span\b([^>]*)data-text-style=["']true["']([^>]*)>([\s\S]*?)<\/span>/gi, (_match, before, after, text) => {
      const attrs = `${before} ${after}`;
      const sizeValue = attribute(attrs, "data-text-size");
      const size = /^(?:small|normal|large|xlarge)$/.test(sizeValue) ? sizeValue : "normal";
      const colorValue = attribute(attrs, "data-text-color");
      const color = /^#[0-9a-f]{6}$/i.test(colorValue) ? colorValue : "#173b51";
      return `{{style size=${size} color=${color}}}${inlineHtmlToMarkdown(text)}{{/style}}`;
    })
    .replace(/<sup\b[^>]*class=["'][^"']*footnote-ref[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/sup>/gi, (_match, id) => `[^${plainText(id)}]`)
    .replace(/<cite\b([^>]*)>[\s\S]*?<\/cite>/gi, (_match, attrs) => {
      const key = attribute(attrs, "data-cite");
      return key ? `[@${key}]` : "";
    })
    .replace(/<studio-math-inline\b([^>]*)>([\s\S]*?)<\/studio-math-inline>/gi, (_match, attrs, text) => {
      const expression = attribute(attrs, "aria-label") || plainText(text);
      return `$${expression}$`;
    })
    .replace(/<span\b([^>]*)class=["'][^"']*math-inline[^"']*["']([^>]*)>([\s\S]*?)<\/span>/gi, (_match, before, after, text) => {
      const expression = attribute(`${before} ${after}`, "aria-label") || plainText(text);
      return `$${expression}$`;
    })
    .replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, "**$1**")
    .replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, "*$1*")
    .replace(/<u\b[^>]*>([\s\S]*?)<\/u>/gi, "++$1++")
    .replace(/<(?:del|s|strike)\b[^>]*>([\s\S]*?)<\/(?:del|s|strike)>/gi, "~~$1~~")
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_match, code) => `\`${plainText(code)}\``)
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_match, attrs, text) => {
      const href = attribute(attrs, "href");
      if (!href) return inlineHtmlToMarkdown(text);
      const target = attribute(attrs, "target") === "_blank" ? "{target=_blank}" : "";
      return `[${inlineHtmlToMarkdown(text)}](${href})${target}`;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ");
}

function imageMarkdown(attrs: string, fallbackSize?: string, fallbackAlign?: string) {
  const assetId = attribute(attrs, "data-asset-id");
  const src = assetId ? `asset:${assetId}` : attribute(attrs, "src") || attribute(attrs, "data-src");
  if (!src) return "";
  const alt = attribute(attrs, "alt").replaceAll("[", "\\[").replaceAll("]", "\\]");
  const title = attribute(attrs, "title");
  const size = mediaSize(attribute(attrs, "data-size") || fallbackSize);
  const requestedAlign = attribute(attrs, "data-align") || fallbackAlign || "center";
  const align = mediaAlign(requestedAlign);
  const figureNumber = attribute(attrs, "data-figure-number");
  const figureLabel = attribute(attrs, "data-figure-label");
  const figureSource = attribute(attrs, "data-figure-source");
  const research = `${figureNumber ? ` figure=${figureNumber}` : ""}${figureLabel ? ` label=${figureLabel}` : ""}${figureSource ? ` source="${figureSource.replaceAll('"', "&quot;")}"` : ""}`;
  return `![${alt}](${src}${title ? ` "${title.replaceAll('"', "&quot;")}"` : ""}){width=${size} align=${align}${research}}`;
}

function tableToMarkdown(inner: string) {
  const rows = [...inner.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...row[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) => inlineHtmlToMarkdown(cell[1]).replace(/\s+/g, " ").trim().replaceAll("|", "\\|")),
  ).filter((row) => row.length);
  if (!rows.length) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")]);
  return `| ${normalized[0].join(" | ")} |\n| ${Array(width).fill("---").join(" | ")} |${normalized.length > 1 ? `\n${normalized.slice(1).map((row) => `| ${row.join(" | ")} |`).join("\n")}` : ""}`;
}

export function htmlToMarkdown(value: string) {
  const tokens: string[] = [];
  const stash = (markdown: string) => {
    const token = `@@STUDIOBLOCK${tokens.length}@@`;
    tokens.push(markdown.trim());
    return `\n\n${token}\n\n`;
  };

  let html = value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  html = html.replace(/<studio-columns\b([^>]*)>([\s\S]*?)<\/studio-columns>/gi, (_match, attrs, inner) => {
    const ratioValue = attribute(attrs, "data-ratio");
    const ratio = /^(?:1:1|2:1|1:2)$/.test(ratioValue) ? ratioValue : "1:1";
    const columns = [...String(inner).matchAll(/<studio-column\b[^>]*>([\s\S]*?)<\/studio-column>/gi)]
      .map((column) => htmlToMarkdown(column[1]).trim())
      .filter(Boolean)
      .slice(0, 2);
    return columns.length ? stash(`:::columns {ratio=${ratio}}\n${columns.map((column) => `:::column\n${column}`).join("\n")}\n:::endcolumns`) : "";
  });

  html = html.replace(/<pre\b[^>]*>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_match, attrs, code) => {
    const className = attribute(attrs, "class");
    const language = className.match(/(?:^|\s)language-([^\s]+)/i)?.[1] ?? "";
    return stash(`\`\`\`${language}\n${decodeEntities(code).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")}\n\`\`\``);
  });

  html = html.replace(/<figure\b([^>]*)class=["']([^"']*content-(?:pdf|video)[^"']*)["']([^>]*)>([\s\S]*?)<\/figure>/gi, (_match, before, classes, after, inner) => {
    const isPdf = /(?:^|\s)content-pdf(?:\s|$)/i.test(classes);
    const media = inner.match(isPdf ? /<iframe\b([^>]*)>/i : /<video\b([^>]*)>/i);
    if (!media) return "";
    const figureAttrs = `${before} ${after}`;
    const assetId = attribute(media[1], "data-asset-id") || attribute(figureAttrs, "data-asset-id");
    const src = assetId ? `asset:${assetId}` : attribute(media[1], "src");
    const caption = inner.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1];
    const label = plainText(caption || attribute(media[1], "title") || (isPdf ? "PDF" : "Video"));
    const posterId = attribute(media[1], "data-poster-asset-id");
    const size = mediaSize(attribute(media[1], "data-size") || attribute(figureAttrs, "data-size"));
    const align = mediaAlign(attribute(media[1], "data-align") || attribute(figureAttrs, "data-align"));
    const options = `{${!isPdf ? `${posterId ? `poster=asset:${posterId} ` : ""}controls=true ` : ""}width=${size} align=${align}}`;
    return src ? stash(`@[${isPdf ? "PDF" : "VIDEO"}:${label}](${src})${options}`) : "";
  });

  html = html.replace(/<section\b([^>]*)class=["'][^"']*content-gallery[^"']*["']([^>]*)>([\s\S]*?)<\/section>/gi, (_match, before, after, inner) => {
    const attrs = `${before} ${after}`;
    const images = [...String(inner).matchAll(/<img\b([^>]*)>/gi)].map((match) => imageMarkdown(match[1])).filter(Boolean);
    const layout = attribute(attrs, "data-gallery-layout") === "grid" ? "grid" : "carousel";
    const size = mediaSize(attribute(attrs, "data-gallery-size") || "medium");
    const frameValue = attribute(attrs, "data-gallery-frame");
    const frame = frameValue === "tall" || frameValue === "standard" ? frameValue : "compact";
    const autoplay = attribute(attrs, "data-gallery-autoplay") === "true";
    const interval = Math.max(3, Math.min(15, Number(attribute(attrs, "data-gallery-interval")) || 5));
    const caption = attribute(attrs, "data-gallery-caption");
    const options = `${layout !== "carousel" ? ` layout=${layout}` : ""}${size !== "medium" ? ` size=${size}` : ""}${frame !== "compact" ? ` frame=${frame}` : ""}${autoplay ? ` autoplay=true interval=${interval}` : ""}${caption ? ` caption="${caption.replaceAll('"', "&quot;")}"` : ""}`;
    return images.length ? stash(`:::gallery${options ? ` {${options.trim()}}` : ""}\n${images.join("\n")}\n:::`) : "";
  });

  html = html.replace(/<div\b([^>]*)class=["'][^"']*content-gallery[^"']*["']([^>]*)>([\s\S]*?)<\/div>/gi, (_match, before, after, inner) => {
    const attrs = `${before} ${after}`;
    const images = [...String(inner).matchAll(/<img\b([^>]*)>/gi)].map((match) => imageMarkdown(match[1])).filter(Boolean);
    const layout = attribute(attrs, "data-gallery-layout") === "grid" ? "grid" : "carousel";
    const size = mediaSize(attribute(attrs, "data-gallery-size") || "medium");
    const frameValue = attribute(attrs, "data-gallery-frame");
    const frame = frameValue === "tall" || frameValue === "standard" ? frameValue : "compact";
    const autoplay = attribute(attrs, "data-gallery-autoplay") === "true";
    const interval = Math.max(3, Math.min(15, Number(attribute(attrs, "data-gallery-interval")) || 5));
    const caption = attribute(attrs, "data-gallery-caption");
    const options = `${layout !== "carousel" ? ` layout=${layout}` : ""}${size !== "medium" ? ` size=${size}` : ""}${frame !== "compact" ? ` frame=${frame}` : ""}${autoplay ? ` autoplay=true interval=${interval}` : ""}${caption ? ` caption="${caption.replaceAll('"', "&quot;")}"` : ""}`;
    return images.length ? stash(`:::gallery${options ? ` {${options.trim()}}` : ""}\n${images.join("\n")}\n:::`) : "";
  });

  html = html.replace(/<aside\b([^>]*)class=["']([^"']*content-callout(?:-[^\s"']+)?[^"']*)["']([^>]*)>([\s\S]*?)<\/aside>/gi, (_match, before, classes, after, inner) => {
    const kind = classes.match(/content-callout-(info|note|warning|success|citation)/i)?.[1]?.toLowerCase() ?? "info";
    const body = inlineHtmlToMarkdown(inner).replace(/\s*\n\s*/g, "\n").trim();
    return stash(`:::${kind}\n${body}\n:::`);
  });

  html = html.replace(/<section\b[^>]*class=["'][^"']*footnotes[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi, (_match, inner) => {
    const definitions = [...String(inner).matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)].map((item) => {
      const id = attribute(item[1], "id").replace(/^fn-/, "");
      const body = item[2].replace(/<a\b[^>]*href=["']#fnref-[^"']+["'][^>]*>[\s\S]*?<\/a>/gi, "");
      return id ? `[^${id}]: ${inlineHtmlToMarkdown(body).trim()}` : "";
    }).filter(Boolean);
    return definitions.length ? stash(definitions.join("\n")) : "";
  });

  html = html.replace(/<div\b([^>]*)class=["'][^"']*math-display[^"']*["']([^>]*)>([\s\S]*?)<\/div>/gi, (_match, before, after, inner) => {
    const attrs = `${before} ${after}`;
    const expression = attribute(attrs, "aria-label") || plainText(inner);
    const number = attribute(attrs, "data-equation-number");
    const label = attribute(attrs, "data-equation-label");
    const options = number || label ? ` {${number ? `number=${number}` : ""}${number && label ? " " : ""}${label ? `label=${label}` : ""}}` : "";
    return stash(`$$${options}\n${expression}\n$$`);
  });

  html = html.replace(/<figure\b([^>]*)class=["'][^"']*content-table-figure[^"']*["']([^>]*)>([\s\S]*?)<\/figure>/gi, (_match, before, after, inner) => {
    const attrs = `${before} ${after}`;
    const table = inner.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i);
    if (!table) return "";
    const number = attribute(attrs, "data-table-number");
    const caption = attribute(attrs, "data-table-caption");
    const label = attribute(attrs, "data-table-label");
    const source = attribute(attrs, "data-table-source");
    const notes = attribute(attrs, "data-table-notes");
    const alignments = attribute(attrs, "data-table-alignments");
    const hasHeader = attribute(attrs, "data-table-header") !== "false";
    const horizontalScroll = attribute(attrs, "data-table-scroll") !== "false";
    const downloadCsv = attribute(attrs, "data-table-download") !== "false";
    const quoted = (text: string) => text.replaceAll('"', "&quot;");
    const options = `${number ? ` number=${number}` : ""}${caption ? ` caption="${quoted(caption)}"` : ""}${label ? ` label=${label}` : ""}${source ? ` source="${quoted(source)}"` : ""}${notes ? ` notes="${quoted(notes)}"` : ""}${alignments ? ` align=${alignments}` : ""}${!hasHeader ? " header=false" : ""}${!horizontalScroll ? " scroll=false" : ""}${!downloadCsv ? " download=false" : ""}`;
    return stash(`:::table${options ? ` {${options.trim()}}` : ""}\n${tableToMarkdown(table[1])}\n:::`);
  });

  html = html.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_match, inner) => stash(tableToMarkdown(inner)));

  html = html.replace(/<(?:div|hr)\b[^>]*data-page-break=["']true["'][^>]*(?:>[\s\S]*?<\/div>|\/?\s*>)/gi, () => stash("<!-- pagebreak -->"));

  html = html.replace(/<figure\b([^>]*)class=["']([^"']*content-image(?:-[^\s"']+)?[^"']*)["']([^>]*)>([\s\S]*?)<\/figure>/gi, (_match, before, classes, after, inner) => {
    const image = inner.match(/<img\b([^>]*)>/i);
    const fallbackSize = classes.match(/content-image-(small|medium|large|full)/i)?.[1];
    const fallbackAlign = classes.match(/content-align-(left|center|right)/i)?.[1] || attribute(`${before} ${after}`, "data-align");
    const figureAttrs = `${before} ${after}`;
    const figureAssetId = attribute(figureAttrs, "data-asset-id");
    const figureNumber = attribute(figureAttrs, "data-figure-number");
    const figureLabel = attribute(figureAttrs, "data-figure-label") || attribute(figureAttrs, "id");
    const figureSource = attribute(figureAttrs, "data-figure-source");
    const imageAttrs = image ? `${image[1]}${figureAssetId && !attribute(image[1], "data-asset-id") ? ` data-asset-id="${figureAssetId}"` : ""}${figureNumber && !attribute(image[1], "data-figure-number") ? ` data-figure-number="${figureNumber}"` : ""}${figureLabel && !attribute(image[1], "data-figure-label") ? ` data-figure-label="${figureLabel}"` : ""}${figureSource && !attribute(image[1], "data-figure-source") ? ` data-figure-source="${figureSource}"` : ""}` : "";
    return image ? stash(imageMarkdown(imageAttrs, fallbackSize, fallbackAlign)) : "";
  });

  html = html.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_match, inner) => {
    const items = [...String(inner).matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((item, index) => `${index + 1}. ${inlineHtmlToMarkdown(item[1]).trim()}`);
    return stash(items.join("\n"));
  });
  html = html.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_match, inner) => {
    const items = [...String(inner).matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((item) => `- ${inlineHtmlToMarkdown(item[1]).trim()}`);
    return stash(items.join("\n"));
  });

  html = html
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, inner) => stash(inlineHtmlToMarkdown(inner).split(/\n+/).filter(Boolean).map((line) => `> ${line.trim()}`).join("\n")))
    .replace(/<hr\b[^>]*\/?\s*>/gi, () => stash("---"))
    .replace(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level, inner) => stash(`${"#".repeat(Number(level))} ${inlineHtmlToMarkdown(inner).trim()}`))
    .replace(/<img\b([^>]*)>/gi, (_match, attrs) => stash(imageMarkdown(attrs)))
    .replace(/<(?:p|div|section|article)\b[^>]*>([\s\S]*?)<\/(?:p|div|section|article)>/gi, (_match, inner) => `\n\n${inlineHtmlToMarkdown(inner)}\n\n`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|section|article)>/gi, "\n\n")
    .replace(/<(?:p|div|section|article)\b[^>]*>/gi, "\n\n");

  const markdown = inlineHtmlToMarkdown(html)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return resolveStudioTokens(markdown, tokens).replace(/\n{3,}/g, "\n\n").trim();
}

export function resolveStudioTokens(markdown: string, tokens: string[]) {
  let resolved = markdown;
  const marker = /@@STUDIOBLOCK\d+@@/;
  const maxPasses = Math.max(2, tokens.length + 1);

  for (let pass = 0; pass < maxPasses && marker.test(resolved); pass += 1) {
    const before = resolved;
    for (let index = tokens.length - 1; index >= 0; index -= 1) {
      resolved = resolved.replaceAll(`@@STUDIOBLOCK${index}@@`, () => tokens[index]);
    }
    if (resolved === before) break;
  }

  if (marker.test(resolved)) {
    throw new Error("Studio content conversion left an unresolved block marker. The document was not changed; switch to Markdown to inspect the affected block.");
  }
  return resolved;
}
