export const NEWS_ARCHIVE_YEARS = Array.from({ length: 10 }, (_, index) => 2025 - index);

function yearMarkers(html: string) {
  const pattern = /(?:<p\b[^>]*>\s*<strong\b[^>]*>\s*((?:19|20)\d{2})\s*<\/strong>\s*<\/p>|<h([1-4])\b[^>]*>\s*((?:19|20)\d{2})\s*<\/h\2>)/gi;
  return [...html.matchAll(pattern)].map((match) => ({
    year: Number(match[1] ?? match[3]),
    index: match.index ?? 0,
    length: match[0].length,
  }));
}

export function extractNewsYears(html: string) {
  return [...new Set(yearMarkers(html).map((marker) => marker.year))].sort((left, right) => right - left);
}

export function extractNewsYearHtml(html: string, year: number) {
  const markers = yearMarkers(html);
  const start = markers.find((marker) => marker.year === year);
  if (!start) return "";
  const contentStart = start.index + start.length;
  const next = markers.find((marker) => marker.index > contentStart);
  const contentEnd = next?.index ?? html.length;
  const content = html.slice(contentStart, contentEnd).trim();
  return content ? `<h2>${year}</h2>\n${content}` : "";
}

