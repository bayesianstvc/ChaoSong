/** Links are navigation data, never executable URL schemes. */
export function safePublicHref(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const href = value.trim();
  if ([...href].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127 || character === "\\")) return null;
  if (/^(?:\/(?!\/)|#|\?|\.\.?\/)/.test(href)) return href;
  try {
    const url = new URL(href);
    return /^(https?:)$/.test(url.protocol) && !url.username && !url.password ? href : null;
  } catch { return null; }
}
