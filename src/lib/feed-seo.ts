import { categoryScope } from "@/lib/categories";

type FeedSearchParams = Record<string, string | string[] | undefined>;

/** Keep the default chronological sequence discoverable without indexing facets. */
export function feedSeo(values: FeedSearchParams) {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const category = first(values.category);
  const scope = categoryScope(category);
  const rawPage = first(values.page);
  const requestedPage = Number(rawPage);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const validPage = rawPage === undefined || (/^[1-9]\d*$/.test(rawPage) && Number.isSafeInteger(requestedPage));
  const validCategory = category === undefined || category === "anything" || Boolean(scope);
  const indexable = validPage && validCategory && Object.entries(values).every(
    ([key, value]) => value === undefined || ((key === "category" || key === "page") && !Array.isArray(value)),
  );
  const search = new URLSearchParams();
  if (scope) search.set("category", scope.value);
  if (page > 1) search.set("page", String(page));
  const query = search.toString();

  return { scope, page, indexable, canonical: query ? `/?${query}` : "/" };
}
