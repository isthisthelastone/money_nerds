import { DEFAULT_FEED_PAGE_SIZE, FEED_PAGE_SIZES, isCategory, isPostLanguage, type FeedParams } from "@/lib/models";

const SORTS = ["latest", "loved", "funded"] as const;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

/** Shared by the HTML board and its Markdown representation. */
export function parseFeedParams(values: Record<string, string | string[] | undefined>): FeedParams {
  const requestedPage = Number(first(values.page));
  const requestedSize = Number(first(values.size));
  const requestedSort = first(values.sort);
  const requestedCategory = first(values.category);
  const requestedLanguage = first(values.language);
  return {
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    pageSize: FEED_PAGE_SIZES.includes(requestedSize as (typeof FEED_PAGE_SIZES)[number]) ? requestedSize : DEFAULT_FEED_PAGE_SIZE,
    sort: SORTS.includes(requestedSort as (typeof SORTS)[number]) ? requestedSort as FeedParams["sort"] : "latest",
    category: isCategory(requestedCategory) ? requestedCategory : "anything",
    language: isPostLanguage(requestedLanguage) || requestedLanguage === "untagged" ? requestedLanguage : "all",
  };
}
