const excerptSegmenter = new Intl.Segmenter("en", {granularity: "grapheme"});

/** A readable, bounded snippet without splitting emoji or repeated whitespace. */
export function metadataExcerpt(value: string, maxLength = 160) {
  const characters = Array.from(excerptSegmenter.segment(value.replace(/\s+/gu, " ").trim()), ({segment}) => segment);
  if (characters.length <= maxLength) return characters.join("");
  const shortened = characters.slice(0, Math.max(1, maxLength - 1)).join("");
  const wordBoundary = shortened.lastIndexOf(" ");
  return `${wordBoundary > shortened.length / 2 ? shortened.slice(0, wordBoundary) : shortened}…`;
}

/**
 * Serialize structured data for an inline script without allowing user-provided
 * text to terminate the script element. JSON itself does not escape `<`, `>`,
 * or `&`, but HTML parsers give those characters special meaning in scripts.
 */
export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
