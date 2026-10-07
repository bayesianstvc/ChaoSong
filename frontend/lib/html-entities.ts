// Decode one layer only. The caller must still escape text for its output context.
// Keeping this DOM-free lets imports, the preview worker and public rendering agree.
const namedEntities: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  hellip: "…", copy: "©", reg: "®", trade: "™", middot: "·", bull: "•",
  laquo: "«", raquo: "»", times: "×", divide: "÷", minus: "−",
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi, (entity, code: string) => {
    if (code[0] !== "#") return namedEntities[code] ?? entity;
    const point = code[1].toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
    if (!Number.isInteger(point) || point <= 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return "\ufffd";
    return String.fromCodePoint(point);
  });
}
