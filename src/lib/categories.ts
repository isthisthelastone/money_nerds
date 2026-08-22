import type { Category } from "@/lib/models";

export interface CategoryScope {
  value: Exclude<Category, "anything">;
  label: string;
  shortDescription: string;
}

export const CATEGORY_SCOPES: readonly CategoryScope[] = [
  {
    value: "for-fun",
    label: "Fun",
    shortDescription: "Playful asks, delightful chaos, and things that make life lighter.",
  },
  {
    value: "memes",
    label: "Memes",
    shortDescription: "Original memes, internet culture, and jokes worth backing.",
  },
  {
    value: "mutual-aid",
    label: "Mutual Aid",
    shortDescription: "Direct community support for real people and immediate needs.",
  },
  {
    value: "build",
    label: "Build",
    shortDescription: "Products, experiments, open-source work, and ambitious ideas.",
  },
  {
    value: "animals",
    label: "Animal Support",
    shortDescription: "Rescue, veterinary care, food, shelter, and animal welfare.",
  },
  {
    value: "art",
    label: "Art",
    shortDescription: "Visual art, music, performance, writing, and creative work.",
  },
  {
    value: "crowdfunding",
    label: "Crowdfunding",
    shortDescription: "Projects and personal goals that need many people behind them.",
  },
  {
    value: "other",
    label: "Other",
    shortDescription: "Everything meaningful, strange, or useful that fits nowhere else.",
  },
] as const;

export function categoryScope(value: string | undefined) {
  return CATEGORY_SCOPES.find((category) => category.value === value);
}

export function categoryHref(value: Category) {
  return value === "anything" ? "/#feed" : `/?category=${encodeURIComponent(value)}#feed`;
}
