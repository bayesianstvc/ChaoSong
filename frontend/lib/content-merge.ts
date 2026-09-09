function plainHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function plainMarkdown(value: string) {
  return value.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[-`#>*_~|]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function mergeComplete(primary: string, additional: string, normalize: (value: string) => string, separator: string) {
  const primaryText = normalize(primary);
  const additionalText = normalize(additional);
  if (!primaryText) return additional;
  if (!additionalText) return primary;
  if (primaryText === additionalText || primaryText.includes(additionalText)) return primary;
  if (additionalText.includes(primaryText)) return additional;
  return `${primary.trim()}${separator}${additional.trim()}`;
}

export function mergeCompleteHtml(primary: string, additional: string) {
  return mergeComplete(primary, additional, plainHtml, "\n");
}

export function mergeCompleteMarkdown(primary: string, additional: string) {
  return mergeComplete(primary, additional, plainMarkdown, "\n\n");
}

export function usesUnifiedFinalContent(type: string, slug: string) {
  return type === "page" && ["about", "news", "publications", "resources", "research", "bstvc"].includes(slug)
    || type === "resource" && slug === "china-county-socioeconomic-statistics-2002-2011";
}
