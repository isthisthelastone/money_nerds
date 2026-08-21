import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/features/PostCard";
import { SITE_URL } from "@/lib/config";
import { getComments, getPost } from "@/lib/data";
import { serializeJsonLd } from "@/lib/seo";

export const revalidate = 300;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

type RouteParams = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return { title: "Post not found" };
  const post = await getPost(id);
  if (!post) return { title: "Post not found" };
  const excerpt = post.body.slice(0, 155) || `A media post by ${post.nickname}`;
  return {
    title: `${post.nickname} asks the internet`,
    description: excerpt,
    alternates: { canonical: `/p/${post.id}` },
    openGraph: {
      type: "article",
      url: `${SITE_URL}/p/${post.id}`,
      title: `${post.nickname} on Money Nerds`,
      description: excerpt,
      publishedTime: post.created_at,
      images: post.media.find((asset) => asset.kind === "image")?.public_url
        ? [{ url: post.media.find((asset) => asset.kind === "image")!.public_url }]
        : [{ url: "/og.png", width: 1733, height: 907 }],
    },
  };
}

export default async function PostPage({ params }: { params: RouteParams }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [post, comments] = await Promise.all([getPost(id), getComments(id)]);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: `${post.nickname} on Money Nerds`,
    articleBody: post.body,
    datePublished: post.created_at,
    dateModified: post.updated_at,
    url: `${SITE_URL}/p/${post.id}`,
    author: {
      "@type": "Person",
      name: post.nickname,
      identifier: post.author_wallet,
      url: `${SITE_URL}/u/${post.author_wallet}`,
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
    ],
  };

  return (
    <main className="site-shell pb-20 pt-10 sm:pt-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <div className="mx-auto max-w-3xl">
        <Link className="mb-5 inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white" href="/#feed">
          <ArrowLeft aria-hidden="true" size={16} /> Back to the board
        </Link>
        <PostCard post={post} detail initialComments={comments} />
      </div>
    </main>
  );
}
