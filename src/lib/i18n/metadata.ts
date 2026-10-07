import "server-only";
import type { Metadata } from "next";
import type { Locale, Translate } from "./config";

export function translateMetadata(metadata: Metadata, t: Translate, locale: Locale): Metadata {
  const translateTitle = (value: Metadata["title"]): Metadata["title"] => typeof value === "string" ? t(value) : value && "default" in value ? { ...value, default: t(value.default) } : value;
  const graph = metadata.openGraph;
  return {
    ...metadata,
    title: translateTitle(metadata.title),
    description: metadata.description ? t(metadata.description) : metadata.description,
    ...(graph ? { openGraph: { ...graph, title: graph.title ? translateTitle(graph.title) ?? undefined : undefined, description: graph.description ? t(graph.description) : graph.description, locale: { en:"en_GB", es:"es_ES", zh:"zh_CN", ru:"ru_RU", vi:"vi_VN" }[locale] } } : {}),
    ...(metadata.twitter ? { twitter: { ...metadata.twitter, title: metadata.twitter.title ? translateTitle(metadata.twitter.title) ?? undefined : undefined, description: metadata.twitter.description ? t(metadata.twitter.description) : metadata.twitter.description } } : {}),
  };
}
