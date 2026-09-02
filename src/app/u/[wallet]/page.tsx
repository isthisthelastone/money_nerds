import type { Metadata } from "next";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ExternalLink,
  MessageCircle,
  Radio,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CopyWalletButton } from "@/components/features/CopyWalletButton";
import { MediaGallery } from "@/components/features/MediaGallery";
import { PostCard } from "@/components/features/PostCard";
import { SITE_URL } from "@/lib/config";
import {
  DEFAULT_PROFILE_ACTIVITY_PARAMS,
  getProfileActivity,
  getWalletProfile,
} from "@/lib/data";
import { formatAtomicAmount, formatRelativeTime, formatWallet } from "@/lib/format";
import {
  addressExplorerUrl,
  isPayoutAsset,
  PAYOUT_ASSET_CONFIG,
  transactionExplorerUrl,
} from "@/lib/funding/payouts";
import {
  IDENTITY_PROVIDER_LABELS,
  PROFILE_PAGE_SIZES,
  type ProfileActivityParams,
  type ProfileActivitySection,
  type ProfileDonationRecord,
  type ProfilePage,
  type ProfilePageSize,
} from "@/lib/models";
import { serializeJsonLd } from "@/lib/seo";
import { normalizeWallet } from "@/lib/wallet";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ wallet: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PROFILE_SECTIONS: ProfileActivitySection[] = ["posts", "comments", "sent", "received"];
const PROFILE_QUERY_KEYS: Record<
  ProfileActivitySection,
  { page: string; size: string }
> = {
  posts: { page: "postsPage", size: "postsSize" },
  comments: { page: "commentsPage", size: "commentsSize" },
  sent: { page: "sentPage", size: "sentSize" },
  received: { page: "receivedPage", size: "receivedSize" },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseProfileActivityParams(
  values: Awaited<SearchParams>,
): ProfileActivityParams {
  const sections = PROFILE_SECTIONS.map((section) => {
    const keys = PROFILE_QUERY_KEYS[section];
    const requestedPage = Number(first(values[keys.page]));
    const requestedSize = Number(first(values[keys.size]));
    return [
      section,
      {
        page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
        pageSize: PROFILE_PAGE_SIZES.includes(requestedSize as ProfilePageSize)
          ? (requestedSize as ProfilePageSize)
          : DEFAULT_PROFILE_ACTIVITY_PARAMS[section].pageSize,
      },
    ] as const;
  });
  return Object.fromEntries(sections) as unknown as ProfileActivityParams;
}

function updateSection(
  params: ProfileActivityParams,
  section: ProfileActivitySection,
  update: Partial<ProfileActivityParams[ProfileActivitySection]>,
): ProfileActivityParams {
  return {
    ...params,
    [section]: { ...params[section], ...update },
  };
}

function profileHref(
  wallet: string,
  params: ProfileActivityParams,
  anchor?: string,
) {
  const search = new URLSearchParams();
  for (const section of PROFILE_SECTIONS) {
    const keys = PROFILE_QUERY_KEYS[section];
    const value = params[section];
    if (value.page > 1) search.set(keys.page, String(value.page));
    if (value.pageSize !== DEFAULT_PROFILE_ACTIVITY_PARAMS[section].pageSize) {
      search.set(keys.size, String(value.pageSize));
    }
  }
  const query = search.toString();
  return `/u/${wallet}${query ? `?${query}` : ""}${anchor ? `#${anchor}` : ""}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const wallet = normalizeWallet((await params).wallet);
  if (!wallet) return { title: "Wallet not found" };
  const [profile, query] = await Promise.all([getWalletProfile(wallet), searchParams]);
  const name = profile?.display_name || formatWallet(wallet, 6, 6);
  const externalProfile = profile?.identity_kind === "external";
  const identityLabel = profile?.identity_provider
    ? IDENTITY_PROVIDER_LABELS[profile.identity_provider]
    : "External";
  const hasQuery = Object.values(query).some((value) => value !== undefined);
  return {
    title: `${name} — public ${externalProfile ? `${identityLabel} profile` : "wallet profile"}`,
    description: externalProfile
      ? `Posts, comments, and transparent multi-network funding from a ${identityLabel}-authenticated Money Nerds profile.`
      : `Posts, comments, and transparent multi-network funding connected to ${formatWallet(wallet, 8, 8)} on Money Nerds.`,
    alternates: { canonical: `/u/${wallet}` },
    robots: hasQuery
      ? {
          index: false,
          follow: true,
          googleBot: { index: false, follow: true },
        }
      : { index: true, follow: true },
    openGraph: {
      type: "profile",
      url: `${SITE_URL}/u/${wallet}`,
      title: `${name} on Money Nerds`,
      images: [{ url: "/og.png", width: 1733, height: 907 }],
    },
  };
}

export default async function WalletProfilePage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: SearchParams;
}) {
  const wallet = normalizeWallet((await params).wallet);
  if (!wallet) notFound();
  const requestedParams = parseProfileActivityParams(await searchParams);
  const activity = await getProfileActivity(wallet, requestedParams);
  if (!activity) notFound();

  const effectiveParams: ProfileActivityParams = {
    posts: { page: activity.posts.page, pageSize: activity.posts.pageSize },
    comments: { page: activity.comments.page, pageSize: activity.comments.pageSize },
    sent: { page: activity.sent.page, pageSize: activity.sent.pageSize },
    received: { page: activity.received.page, pageSize: activity.received.pageSize },
  };
  if (
    PROFILE_SECTIONS.some(
      (section) => requestedParams[section].page !== effectiveParams[section].page,
    )
  ) {
    redirect(profileHref(wallet, effectiveParams));
  }

  const aliases = Array.from(
    new Set(
      [
        ...activity.posts.items.map((post) => post.nickname),
        ...activity.comments.items.map((comment) => comment.nickname),
      ].filter(Boolean),
    ),
  );
  const sentAssetCount = activity.funding_totals.filter((total) => total.sent_count > 0).length;
  const receivedAssetCount = activity.funding_totals.filter(
    (total) => total.received_count > 0,
  ).length;
  const displayName = activity.profile.display_name || formatWallet(wallet, 6, 6);
  const externalProfile = activity.profile.identity_kind === "external";
  const identityLabel = activity.profile.identity_provider
    ? IDENTITY_PROVIDER_LABELS[activity.profile.identity_provider]
    : "External";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${SITE_URL}/u/${wallet}`,
    dateCreated: activity.profile.created_at,
    mainEntity: {
      "@type": "Person",
      name: displayName,
      identifier: wallet,
      description:
        activity.profile.bio ||
        (externalProfile
          ? `A ${identityLabel}-authenticated Money Nerds profile with transparent direct-funding activity.`
          : "A public Money Nerds profile with transparent direct-funding activity."),
    },
  };

  return (
    <main className="site-shell pb-20 pt-10 sm:pt-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <section className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#111311]">
        <div className="border-b border-white/8 bg-[radial-gradient(circle_at_80%_0%,rgba(201,255,85,.16),transparent_38%)] p-6 sm:p-9">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#c9ff55]">
            <Radio aria-hidden="true" size={14} /> Public {externalProfile ? `${identityLabel} profile` : "Money Nerds profile"}
          </p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-3 sm:gap-4">
                {activity.profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activity.profile.avatar_url}
                    alt=""
                    className="size-12 rounded-full border border-white/12 bg-black/20 object-cover sm:size-16"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <h1 className="text-3xl font-semibold tracking-tight text-[#f2efe6] sm:text-5xl">
                  {displayName}
                </h1>
              </div>
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-white/35">
                Money Nerds profile ID
              </p>
              <p className="mt-1 break-all font-mono text-xs text-white/45 sm:text-sm">
                {wallet}
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
                This stable profile ID links posts, comments, and verified transfers. Funding
                destinations are listed separately for each asset and network.
              </p>
              {activity.profile.bio ? (
                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/60">
                  {activity.profile.bio}
                </p>
              ) : null}
            </div>
            <CopyWalletButton walletAddress={wallet} label="Copy profile ID" />
          </div>
          {aliases.length ? (
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-white/40">
              <span>Names in the activity shown below</span>
              {aliases.map((alias) => (
                <span
                  key={alias}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-white/65"
                >
                  {alias}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 divide-x divide-y divide-white/8 sm:grid-cols-4 sm:divide-y-0">
          <div className="p-5">
            <dt className="text-xs text-white/40">Posts</dt>
            <dd className="mt-2 text-2xl font-semibold text-[#f2efe6]">
              {activity.stats.post_count}
            </dd>
          </div>
          <div className="p-5">
            <dt className="text-xs text-white/40">Comments</dt>
            <dd className="mt-2 text-2xl font-semibold text-[#f2efe6]">
              {activity.stats.comment_count}
            </dd>
          </div>
          <div className="p-5">
            <dt className="text-xs text-white/40">Verified sent</dt>
            <dd className="mt-2 text-xl font-semibold text-[#f2efe6]">
              {activity.sent.total} transfer{activity.sent.total === 1 ? "" : "s"}
            </dd>
            <p className="mt-1 text-[0.68rem] text-white/35">Across {sentAssetCount} asset{sentAssetCount === 1 ? "" : "s"}</p>
          </div>
          <div className="p-5">
            <dt className="text-xs text-white/40">Verified received</dt>
            <dd className="mt-2 text-xl font-semibold text-[#c9ff55]">
              {activity.received.total} transfer{activity.received.total === 1 ? "" : "s"}
            </dd>
            <p className="mt-1 text-[0.68rem] text-white/35">Across {receivedAssetCount} asset{receivedAssetCount === 1 ? "" : "s"}</p>
          </div>
        </dl>
        {activity.funding_routes.length ? (
          <div className="border-t border-white/8 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
              Accepts direct funding
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activity.funding_routes.map((route) => {
                const asset = isPayoutAsset(route.asset) ? route.asset : null;
                const explorer = asset
                  ? addressExplorerUrl(asset, route.recipient_address)
                  : null;
                return (
                  <a
                    key={route.id}
                    className="rounded-xl border border-white/8 bg-black/15 p-3 transition hover:border-[#c9ff55]/30"
                    href={explorer ?? undefined}
                    target={explorer ? "_blank" : undefined}
                    rel={explorer ? "noreferrer" : undefined}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <strong className="text-sm text-[#f2efe6]">{route.asset}</strong>
                      <span className={`rounded-full px-2 py-0.5 text-[0.62rem] ${
                        route.verification_status === "verified"
                          ? "bg-[#c9ff55]/12 text-[#dfff9c]"
                          : "bg-white/7 text-white/45"
                      }`}>
                        {route.verification_status === "verified" ? "Ownership verified" : "User declared"}
                      </span>
                    </span>
                    <code className="mt-2 block break-all font-mono text-[0.65rem] leading-4 text-white/35">
                      {route.recipient_address}
                    </code>
                  </a>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      {activity.funding_totals.length ? (
        <section className="mt-6 rounded-[1.4rem] border border-white/10 bg-[#111311] p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#c9ff55]">
            Exact verified totals
          </p>
          <p className="mt-2 text-sm leading-6 text-white/48">
            Assets stay separate; unlike currencies are never combined into a misleading total.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {activity.funding_totals.map((total) => {
              const config = isPayoutAsset(total.asset)
                ? PAYOUT_ASSET_CONFIG[total.asset]
                : null;
              return (
                <div key={`${total.chain_namespace}:${total.network_reference}:${total.asset}`} className="rounded-xl border border-white/8 bg-black/15 p-3.5">
                  <strong className="text-sm text-[#f2efe6]">{total.asset}</strong>
                  <dl className="mt-2 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-white/35">Sent</dt>
                      <dd className="mt-1 font-medium text-white/75">
                        {formatAtomicAmount(total.sent_atomic, config?.decimals ?? 0)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-white/35">Received</dt>
                      <dd className="mt-1 font-medium text-[#c9ff55]">
                        {formatAtomicAmount(total.received_atomic, config?.decimals ?? 0)}
                      </dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-10" id="posts" aria-labelledby="wallet-posts-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#c9ff55]">
              Published asks
            </p>
            <h2
              className="mt-2 text-2xl font-semibold tracking-tight text-[#f2efe6]"
              id="wallet-posts-title"
            >
              Posts
            </h2>
          </div>
          <p className="text-sm text-white/40">{activity.posts.total} total</p>
        </div>
        <div className="mt-4 grid gap-5">
          {activity.posts.items.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {!activity.posts.items.length ? (
            <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">
              No posts from this profile yet.
            </p>
          ) : null}
        </div>
        <SectionPager
          wallet={wallet}
          params={effectiveParams}
          section="posts"
          pageData={activity.posts}
          label="Posts"
          anchor="posts"
        />
      </section>

      <div className="mt-10 grid items-start gap-6 xl:grid-cols-3">
        <section
          className="rounded-[1.4rem] border border-white/10 bg-[#111311] p-5"
          id="comments"
          aria-labelledby="wallet-comments-title"
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              className="flex items-center gap-2 text-lg font-semibold text-[#f2efe6]"
              id="wallet-comments-title"
            >
              <MessageCircle aria-hidden="true" size={18} /> Comments
            </h2>
            <span className="text-xs text-white/35">{activity.comments.total} total</span>
          </div>
          <div className="mt-4 grid gap-4">
            {activity.comments.items.map((comment) => (
              <article
                key={comment.id}
                className="border-t border-white/8 pt-4 first:border-0 first:pt-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/35">
                  <strong className="font-medium text-white/70">{comment.nickname}</strong>
                  <time dateTime={comment.created_at} suppressHydrationWarning>
                    {formatRelativeTime(comment.created_at)}
                  </time>
                </div>
                {comment.body ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/65">
                    {comment.body}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-white/45">Media comment</p>
                )}
                <MediaGallery media={comment.media} />
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.68rem] text-white/35">
                  <Link className="text-[#9ccaff] hover:underline" href={`/p/${comment.post_id}`}>
                    Post #{comment.post_id}
                  </Link>
                  <span>Comment #{comment.id}</span>
                  {comment.parent_id ? <span>Reply to #{comment.parent_id}</span> : null}
                  {comment.funding_totals.map((total) => {
                    const config = isPayoutAsset(total.asset)
                      ? PAYOUT_ASSET_CONFIG[total.asset]
                      : null;
                    return (
                      <span key={total.asset}>
                        {formatAtomicAmount(total.received_atomic, config?.decimals ?? 0)} {total.asset} received
                      </span>
                    );
                  })}
                </div>
              </article>
            ))}
            {!activity.comments.items.length ? (
              <p className="text-sm text-white/40">No comments yet.</p>
            ) : null}
          </div>
          <SectionPager
            wallet={wallet}
            params={effectiveParams}
            section="comments"
            pageData={activity.comments}
            label="Comments"
            anchor="comments"
          />
        </section>

        <DonationLedger
          title="Verified sent"
          direction="sent"
          page={activity.sent}
          wallet={wallet}
          params={effectiveParams}
        />
        <DonationLedger
          title="Verified received"
          direction="received"
          page={activity.received}
          wallet={wallet}
          params={effectiveParams}
        />
      </div>
    </main>
  );
}

interface PagerData {
  page: number;
  pageSize: ProfilePageSize;
  total: number;
  totalPages: number;
  from: number;
  to: number;
}

function SectionPager({
  wallet,
  params,
  section,
  pageData,
  label,
  anchor,
}: {
  wallet: string;
  params: ProfileActivityParams;
  section: ProfileActivitySection;
  pageData: PagerData;
  label: string;
  anchor: string;
}) {
  return (
    <nav
      className="mt-5 grid gap-3 border-t border-white/8 pt-4 text-xs text-white/40"
      aria-label={`${label} pagination`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          Showing {pageData.from}–{pageData.to} of {pageData.total}
        </span>
        <div className="flex items-center gap-1" aria-label={`${label} page size`}>
          <span className="mr-1">Per page</span>
          {PROFILE_PAGE_SIZES.map((size) =>
            size === pageData.pageSize ? (
              <span
                key={size}
                className="rounded-md bg-[#c9ff55] px-2 py-1 font-semibold text-[#10120f]"
                aria-current="true"
              >
                {size}
              </span>
            ) : (
              <Link
                key={size}
                className="rounded-md border border-white/10 px-2 py-1 text-white/55 hover:border-white/25 hover:text-white"
                href={profileHref(
                  wallet,
                  updateSection(params, section, { page: 1, pageSize: size }),
                  anchor,
                )}
              >
                {size}
              </Link>
            ),
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        {pageData.page > 1 ? (
          <Link
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white"
            href={profileHref(
              wallet,
              updateSection(params, section, { page: pageData.page - 1 }),
              anchor,
            )}
          >
            <ArrowLeft aria-hidden="true" size={14} /> Previous
          </Link>
        ) : (
          <span />
        )}
        <span>
          Page {pageData.page} of {pageData.totalPages}
        </span>
        {pageData.page < pageData.totalPages ? (
          <Link
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white"
            href={profileHref(
              wallet,
              updateSection(params, section, { page: pageData.page + 1 }),
              anchor,
            )}
          >
            Next <ArrowRight aria-hidden="true" size={14} />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </nav>
  );
}

function DonationLedger({
  title,
  direction,
  page,
  wallet,
  params,
}: {
  title: string;
  direction: "sent" | "received";
  page: ProfilePage<ProfileDonationRecord>;
  wallet: string;
  params: ProfileActivityParams;
}) {
  const Icon = direction === "sent" ? ArrowUpRight : ArrowDownLeft;
  const section = direction;
  return (
    <section
      className="rounded-[1.4rem] border border-white/10 bg-[#111311] p-5"
      id={section}
      aria-labelledby={`${section}-donations-title`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          className="flex items-center gap-2 text-lg font-semibold text-[#f2efe6]"
          id={`${section}-donations-title`}
        >
          <Icon aria-hidden="true" size={18} /> {title}
        </h2>
        <span className="text-xs text-white/35">{page.total} total</span>
      </div>
      <div className="mt-4 grid gap-4">
        {page.items.map((donation) => {
          const profileName = donation.counterpart_profile?.display_name;
          const counterpartLabel = profileName || formatWallet(donation.counterpart_wallet, 6, 6);
          const asset = isPayoutAsset(donation.asset) ? donation.asset : null;
          const amount = formatAtomicAmount(
            donation.amount_atomic,
            asset ? PAYOUT_ASSET_CONFIG[asset].decimals : 0,
          );
          const transactionUrl = asset
            ? transactionExplorerUrl(asset, donation.signature)
            : null;
          const counterpartUrl = asset
            ? addressExplorerUrl(asset, donation.counterpart_wallet)
            : null;
          return (
            <article
              key={donation.record_id}
              className="border-t border-white/8 pt-4 text-sm first:border-0 first:pt-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <strong className="font-semibold text-[#f2efe6]">
                  {amount} {donation.asset}
                </strong>
                <time
                  className="text-[0.68rem] text-white/35"
                  dateTime={donation.created_at}
                  suppressHydrationWarning
                >
                  {formatRelativeTime(donation.created_at)}
                </time>
              </div>
              <div className="mt-2 grid gap-1.5 text-xs leading-5 text-white/45">
                <p>
                  {direction === "sent" ? "To" : "From"}{" "}
                  {donation.counterpart_profile ? (
                    <Link
                      className="font-medium text-[#9ccaff] hover:underline"
                      href={`/u/${donation.counterpart_wallet}`}
                    >
                      {counterpartLabel}
                    </Link>
                  ) : (
                    counterpartUrl ? (
                      <a
                        className="font-medium text-[#9ccaff] hover:underline"
                        href={counterpartUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {counterpartLabel}
                      </a>
                    ) : (
                      <span>{counterpartLabel}</span>
                    )
                  )}
                </p>
                <code className="break-all font-mono text-[0.65rem] text-white/30">
                  {donation.counterpart_wallet}
                </code>
                <p>
                  Target: <DonationTarget donation={donation} />
                </p>
              </div>
              {transactionUrl ? (
                <a
                  className="mt-2 inline-flex items-center gap-1.5 font-mono text-[0.68rem] text-[#9ccaff] hover:underline"
                  href={transactionUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`View ${amount} ${donation.asset} donation in its network explorer`}
                >
                  View transaction · {formatWallet(donation.signature, 6, 6)}
                  <ExternalLink aria-hidden="true" size={12} />
                </a>
              ) : null}
            </article>
          );
        })}
        {!page.items.length ? (
          <p className="text-sm text-white/40">No verified transfers yet.</p>
        ) : null}
      </div>
      <SectionPager
        wallet={wallet}
        params={params}
        section={section}
        pageData={page}
        label={title}
        anchor={section}
      />
    </section>
  );
}

function DonationTarget({ donation }: { donation: ProfileDonationRecord }) {
  if (donation.target_type === "post" && donation.post_id) {
    return (
      <Link className="text-[#9ccaff] hover:underline" href={`/p/${donation.post_id}`}>
        Post #{donation.post_id}
      </Link>
    );
  }
  if (donation.target_type === "comment" && donation.comment_id) {
    return donation.target_post_id ? (
      <Link className="text-[#9ccaff] hover:underline" href={`/p/${donation.target_post_id}`}>
        Comment #{donation.comment_id} on post #{donation.target_post_id}
      </Link>
    ) : (
      <span>Comment #{donation.comment_id} (post unavailable)</span>
    );
  }
  return (
    <Link className="text-[#9ccaff] hover:underline" href="/transparency">
      Money Nerds service
    </Link>
  );
}
