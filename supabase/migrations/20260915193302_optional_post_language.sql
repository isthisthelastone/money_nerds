-- Optional, author-declared language. Never infer the language of historical UGC.
alter table public.posts add column if not exists language text;
alter table public.posts add constraint posts_language_supported
  check (language is null or language in ('en', 'es', 'zh', 'ru', 'vi'));
create index if not exists posts_language_created_id_idx
  on public.posts (language, created_at desc, id desc);

-- Preserve existing fields, grants and invoker security; append the new column.
create or replace view public.post_cards with (security_invoker = true) as
select p.id, p.author_wallet, p.nickname, p.body, p.category,
  p.created_at, p.updated_at, p.image_url as legacy_image_url,
  p.like_count, p.legacy_unattributed_like_count as legacy_like_count,
  p.verified_donation_lamports, p.legacy_donation_lamports, p.comment_count,
  coalesce(media_rows.media, '[]'::jsonb) as media, p.view_count,
  author_profile.identity_kind as author_identity_kind,
  author_profile.identity_provider as author_identity_provider,
  coalesce(total_rows.funding_totals, '[]'::jsonb) as funding_totals,
  p.language
from public.posts p
join public.profiles author_profile on author_profile.wallet_address = p.author_wallet
left join lateral (
  select jsonb_agg(jsonb_build_object(
    'id', asset.id, 'kind', asset.kind, 'public_url', asset.public_url,
    'mime_type', asset.mime_type, 'width', asset.width, 'height', asset.height,
    'duration_seconds', asset.duration_seconds, 'alt_text', asset.alt_text,
    'position', post_media.position) order by post_media.position, asset.created_at) as media
  from public.post_media post_media
  join public.media_assets asset on asset.id = post_media.media_id and asset.status = 'published'
  where post_media.post_id = p.id
) media_rows on true
left join lateral (
  select jsonb_agg(jsonb_build_object('asset', total.asset,
    'received_atomic', total.received_atomic::text,
    'donation_count', total.donation_count) order by total.asset) as funding_totals
  from public.post_funding_totals total where total.post_id = p.id
) total_rows on true;

-- Called only after server authentication. The wrapper is INVOKER, not a new RLS bypass.
create or replace function public.publish_post_with_language(
  p_wallet_address text, p_nickname text, p_body text, p_category text,
  p_media_ids uuid[] default array[]::uuid[],
  p_funding_options jsonb default '[]'::jsonb,
  p_language text default null, p_include_sbp boolean default false
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare published jsonb;
begin
  if p_language is not null and p_language not in ('en', 'es', 'zh', 'ru', 'vi') then
    raise exception 'Invalid post language';
  end if;
  if p_include_sbp then
    published := public.publish_post_with_sbp(p_wallet_address, p_nickname, p_body, p_category, p_media_ids, p_funding_options);
  else
    published := public.publish_post_with_media(p_wallet_address, p_nickname, p_body, p_category, p_media_ids, p_funding_options);
  end if;
  update public.posts set language = p_language
    where id = (published ->> 'id')::bigint and author_wallet = p_wallet_address;
  if not found then raise exception 'Post language could not be saved'; end if;
  return published;
end;
$$;
revoke all on function public.publish_post_with_language(text,text,text,text,uuid[],jsonb,text,boolean) from public, anon, authenticated;
grant execute on function public.publish_post_with_language(text,text,text,text,uuid[],jsonb,text,boolean) to service_role;
