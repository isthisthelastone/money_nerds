import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/features/PostCard";
import { categoryHref, categoryScope } from "@/lib/categories";
import { SITE_URL } from "@/lib/config";
import { getComments, getPost } from "@/lib/data";
import { type CommentCardData, type MediaAsset } from "@/lib/models";
import { metadataExcerpt, serializeJsonLd } from "@/lib/seo";

// Clerk reads the request session in the shared layout. Rendering an on-demand
// dynamic post as ISR makes Next.js attempt a static pass and fail with
// DYNAMIC_SERVER_USAGE before the page can reach its public Supabase data.
export const dynamic = "force-dynamic";

type RouteParams = Promise<{ id: string }>;

function inlineMediaSchema(media: MediaAsset[]) {
  const images = media.filter((asset) => asset.kind === "image").map((asset) => asset.public_url);
  const recordings = media.filter((asset) => asset.kind !== "image").map((asset) => ({
    "@type": "MediaObject",
    contentUrl: asset.public_url,
    encodingFormat: asset.mime_type,
    ...(asset.alt_text ? {description: asset.alt_text} : {}),
  }));
  return {
    ...(images.length ? {image: images} : {}),
    // Recordings do not yet have real thumbnail metadata. Do not invent a
    // VideoObject thumbnail or claim eligibility for a video rich result.
    ...(recordings.length ? {encoding: recordings} : {}),
  };
}

interface CommentSchema {
  "@type": "Comment";
  text?: string;
  datePublished: string;
  author: { "@type": "Person"; name: string; url?: string };
  comment?: CommentSchema[];
  interactionStatistic: { "@type": "InteractionCounter"; interactionType: string; userInteractionCount: number };
}

function visibleCommentsSchema(comments: CommentCardData[], parentId: number | null = null): CommentSchema[] {
  return comments.filter((comment) => comment.parent_id === parentId).flatMap((comment) => {
    // Match the SSR-visible thread tree. Audio/video-only comments remain
    // visible to people, but cannot satisfy Google's text/image requirements
    // without fabricating a transcript or video thumbnail.
    if (!comment.body.trim() && !comment.media.some((asset) => asset.kind === "image")) return [];
    const replies = visibleCommentsSchema(comments, comment.id);
    return [{
      "@type": "Comment" as const,
      ...(comment.body ? {text: comment.body} : {}),
      ...inlineMediaSchema(comment.media),
      datePublished: comment.created_at,
      author: {
        "@type": "Person" as const,
        name: comment.nickname || comment.legacy_author_label || "Anonymous nerd",
        ...(comment.author_wallet ? {url: `${SITE_URL}/u/${encodeURIComponent(comment.author_wallet)}`} : {}),
      },
      interactionStatistic: {
        "@type": "InteractionCounter" as const,
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: comment.like_count,
      },
      ...(replies.length ? {comment: replies} : {}),
    }];
  });
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return { title: "Post not found", robots: {index: false, follow: false} };
  const post = await getPost(id);
  if (!post) return { title: "Post not found", robots: {index: false, follow: false} };
  const scope = categoryScope(post.category);
  const excerpt = metadataExcerpt(post.body) || `A ${scope?.label.toLowerCase() ?? "public"} media post by ${post.nickname}. Read the discussion and available direct-support options on Money Nerds.`;
  const title = metadataExcerpt(post.body, 65) || `${post.nickname}'s ${scope?.label ?? "public"} post`;
  const image = post.media.find((asset) => asset.kind === "image");
  const images = image
    ? [{url: image.public_url, alt: image.alt_text || `Image attached to ${post.nickname}'s post`}]
    : [{url: "/og.png", width: 1733, height: 907, alt: "Money Nerds — Ask. Share. Fund."}];
  return {
    title,
    description: excerpt,
    alternates: { canonical: `/p/${post.id}` },
    openGraph: {
      type: "article",
      siteName: "Money Nerds",
      url: `${SITE_URL}/p/${post.id}`,
      title,
      description: excerpt,
      publishedTime: post.created_at,
      modifiedTime: post.updated_at,
      authors: [`${SITE_URL}/u/${encodeURIComponent(post.author_wallet)}`],
      ...(scope ? {section: scope.label} : {}),
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: excerpt,
      images,
    },
  };
}

export default async function PostPage({ params }: { params: RouteParams }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [post, comments] = await Promise.all([getPost(id), getComments(id)]);
  if (!post) notFound();
  const scope = categoryScope(post.category);
  const canonicalUrl = `${SITE_URL}/p/${post.id}`;
  const forumEligibleContent = Boolean(post.body.trim() || post.media.some((asset) => asset.kind === "image"));
  const commentsSchema = visibleCommentsSchema(comments);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": forumEligibleContent ? "DiscussionForumPosting" : "CreativeWork",
    "@id": `${canonicalUrl}#post`,
    mainEntityOfPage: canonicalUrl,
    ...(post.body ? {text: post.body} : {}),
    ...inlineMediaSchema(post.media),
    datePublished: post.created_at,
    dateModified: post.updated_at,
    url: canonicalUrl,
    isPartOf: scope ? `${SITE_URL}/?category=${scope.value}` : SITE_URL,
    commentCount: post.comment_count,
    ...(commentsSchema.length ? {comment: commentsSchema} : {}),
    author: {
      "@type": "Person",
      name: post.nickname,
      url: `${SITE_URL}/u/${encodeURIComponent(post.author_wallet)}`,
    },
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: post.like_count + post.legacy_like_count,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: post.comment_count,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ViewAction",
        userInteractionCount: post.view_count,
      },
    ],
  };
  const breadcrumbs = [
    {"@type": "ListItem", position: 1, name: "All posts", item: SITE_URL},
    ...(scope ? [{"@type": "ListItem", position: 2, name: scope.label, item: `${SITE_URL}/?category=${scope.value}`}] : []),
    {"@type": "ListItem", position: scope ? 3 : 2, name: `Post #${post.id}`, item: canonicalUrl},
  ];

  return (
    <main className="site-shell pb-20 pt-10 sm:pt-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({"@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: breadcrumbs}) }} />
      <div className="mx-auto max-w-3xl">
        <nav className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/50" aria-label="Breadcrumb">
          <Link className="inline-flex items-center gap-2 transition hover:text-white" href="/#feed">
            <ArrowLeft aria-hidden="true" size={16} /> All posts
          </Link>
          {scope ? <><span aria-hidden="true">/</span><Link className="transition hover:text-white" href={categoryHref(scope.value)}>{scope.label}</Link></> : null}
          <span aria-hidden="true">/</span><span aria-current="page">Post #{post.id}</span>
        </nav>
        <h1 className="sr-only">Post by {post.nickname}{scope ? ` in ${scope.label}` : ""}</h1>
        <PostCard post={post} detail initialComments={comments} />
      </div>
    </main>
  );
}
