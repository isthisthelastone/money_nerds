/** Explicit Markdown preference only: ordinary browser and React requests stay HTML. */
export function prefersMarkdown(accept: string | null) {
  if (!accept) return false;
  const ranges = accept.toLowerCase().split(",").map((part) => {
    const [type, ...parameters] = part.trim().split(";");
    const quality = parameters.map((parameter) => parameter.trim()).find((parameter) => parameter.startsWith("q="));
    const q = quality ? Number(quality.slice(2)) : 1;
    return { type, q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0 };
  });
  const markdown = Math.max(0, ...ranges.filter(({type}) => type === "text/markdown").map(({q}) => q));
  const html = ranges.find(({type}) => type === "text/html")?.q
    ?? ranges.find(({type}) => type === "text/*")?.q
    ?? ranges.find(({type}) => type === "*/*")?.q
    ?? 0;
  return markdown > 0 && markdown >= html;
}
