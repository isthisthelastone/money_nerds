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
