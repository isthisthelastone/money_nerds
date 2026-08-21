begin;

-- Media is private while a composer draft is unfinished. Published cards expose
-- a stable application URL that signs a short-lived Storage read only after the
-- asset is atomically linked to a post or comment.
alter table public.media_assets
  add column if not exists status text not null default 'staged',
  add column if not exists expires_at timestamptz default (now() + interval '1 hour'),
  add column if not exists published_at timestamptz;

-- The original schema required an absolute public Storage URL. Assets now use a
-- stable application route while the underlying bucket remains private.
alter table public.media_assets
  drop constraint if exists media_assets_public_url;

update public.media_assets m
set status = case
      when exists (select 1 from public.post_media pm where pm.media_id = m.id)
        or exists (select 1 from public.comment_media cm where cm.media_id = m.id)
        then 'published'
      else 'staged'
    end,
    expires_at = case
      when exists (select 1 from public.post_media pm where pm.media_id = m.id)
        or exists (select 1 from public.comment_media cm where cm.media_id = m.id)
        then null
      else coalesce(m.expires_at, now() + interval '1 hour')
    end,
    published_at = case
      when exists (select 1 from public.post_media pm where pm.media_id = m.id)
        or exists (select 1 from public.comment_media cm where cm.media_id = m.id)
        then coalesce(m.published_at, m.created_at)
      else null
    end,
    public_url = '/media/' || m.id::text;

alter table public.media_assets
  add constraint media_assets_public_url check (
    public_url = '/media/' || id::text
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'media_assets_publication_state'
      and conrelid = 'public.media_assets'::regclass
  ) then
    alter table public.media_assets
      add constraint media_assets_publication_state check (
        (
          status = 'staged'
          and expires_at is not null
          and expires_at > created_at
          and published_at is null
        )
        or (
          status = 'published'
          and expires_at is null
          and published_at is not null
          and published_at >= created_at
        )
      );
  end if;
end
$$;

create index if not exists media_assets_staged_expiry_idx
  on public.media_assets (expires_at, id)
  where status = 'staged';

-- Keep quota consumption after staged metadata is deleted so repeated
-- upload/delete cycles cannot bypass the hourly limits. Minute buckets give a
-- conservative rolling-hour window while keeping each wallet's ledger bounded.
create table if not exists public.media_upload_windows (
  wallet_address text not null,
  window_started_at timestamptz not null,
  file_count integer not null,
  byte_count bigint not null,
  primary key (wallet_address, window_started_at),
  constraint media_upload_windows_wallet check (
    wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  ),
  constraint media_upload_windows_counts check (
    file_count > 0 and byte_count > 0
  )
);
create index if not exists media_upload_windows_expiry_idx
  on public.media_upload_windows (window_started_at);
alter table public.media_upload_windows enable row level security;
drop policy if exists clients_denied on public.media_upload_windows;
create policy clients_denied on public.media_upload_windows
for all to anon, authenticated using (false) with check (false);
revoke all on public.media_upload_windows from public, anon, authenticated;
grant select, insert, update, delete on public.media_upload_windows to service_role;

-- Enforce the upload quota at the database boundary as well as in the API. The
-- per-wallet lock prevents concurrent signing requests from racing the count.
create or replace function public.enforce_media_asset_hourly_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recent_count bigint;
  recent_bytes bigint;
  observed_at timestamptz;
  bucket_start timestamptz;
  cutoff_bucket timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('money-nerds-media:' || new.owner_wallet, 0)
  );
  observed_at := clock_timestamp();
  bucket_start := date_trunc('minute', observed_at);
  cutoff_bucket := date_trunc('minute', observed_at - interval '1 hour');

  delete from public.media_upload_windows w
  where w.wallet_address = new.owner_wallet
    and w.window_started_at < cutoff_bucket;

  insert into public.media_upload_windows (
    wallet_address, window_started_at, file_count, byte_count
  ) values (
    new.owner_wallet, bucket_start, 1, new.size_bytes
  )
  on conflict (wallet_address, window_started_at)
  do update set
    file_count = public.media_upload_windows.file_count + 1,
    byte_count = public.media_upload_windows.byte_count + excluded.byte_count;

  select coalesce(sum(w.file_count), 0)::bigint,
         coalesce(sum(w.byte_count), 0)::bigint
  into recent_count, recent_bytes
  from public.media_upload_windows w
  where w.wallet_address = new.owner_wallet
    and w.window_started_at >= cutoff_bucket;

  if recent_count > 24 or recent_bytes > 125829120 then
    raise exception 'Media upload quota exceeded';
  end if;
  return new;
end
$$;

drop trigger if exists media_assets_enforce_hourly_quota on public.media_assets;
create trigger media_assets_enforce_hourly_quota
before insert on public.media_assets
for each row execute function public.enforce_media_asset_hourly_quota();

-- Linking is the publication boundary. This state transition is in the same
-- transaction as the link insert and also prevents one asset being reused by
-- multiple posts or comments, even if a caller does not use the publish RPCs.
create or replace function public.publish_linked_media_asset()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.media_id = old.media_id then
      return new;
    end if;
  end if;

  update public.media_assets a
  set status = 'published',
      expires_at = null,
      published_at = now()
  where a.id = new.media_id
    and a.status = 'staged'
    and a.expires_at > now();

  if not found then
    raise exception 'Media is missing, expired, or already published';
  end if;
  return new;
end
$$;

drop trigger if exists post_media_publish_asset on public.post_media;
create trigger post_media_publish_asset
after insert or update of media_id on public.post_media
for each row execute function public.publish_linked_media_asset();

drop trigger if exists comment_media_publish_asset on public.comment_media;
create trigger comment_media_publish_asset
after insert or update of media_id on public.comment_media
for each row execute function public.publish_linked_media_asset();

drop policy if exists public_read on public.media_assets;
drop policy if exists media_assets_public_read on public.media_assets;
create policy media_assets_public_read on public.media_assets
for select to anon, authenticated
using (status = 'published');

update storage.buckets set public = false where id = 'media';
drop policy if exists media_public_read on storage.objects;
-- ACL ownership differs between hosted Supabase installations; RLS has the final
-- say and there is deliberately no browser SELECT or mutation policy.
revoke select, insert, update, delete, truncate, references, trigger
on storage.objects from public, anon, authenticated;

create or replace view public.post_cards
with (security_invoker = true)
as
select
  p.id,
  p.author_wallet,
  p.nickname,
  p.body,
  p.category,
  p.created_at,
  p.updated_at,
  p.image_url as legacy_image_url,
  p.like_count,
  p.legacy_unattributed_like_count as legacy_like_count,
  p.verified_donation_lamports,
  p.legacy_donation_lamports,
  p.comment_count,
  coalesce(m.media, '[]'::jsonb) as media
from public.posts p
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'kind', a.kind,
      'public_url', a.public_url,
      'mime_type', a.mime_type,
      'width', a.width,
      'height', a.height,
      'duration_seconds', a.duration_seconds,
      'alt_text', a.alt_text,
      'position', pm.position
    ) order by pm.position, a.created_at
  ) as media
  from public.post_media pm
  join public.media_assets a on a.id = pm.media_id and a.status = 'published'
  where pm.post_id = p.id
) m on true;

create or replace view public.comment_cards
with (security_invoker = true)
as
select
  c.id,
  c.post_id,
  c.parent_id,
  c.author_wallet,
  c.legacy_author_label,
  c.nickname,
  c.body,
  c.created_at,
  c.like_count,
  c.verified_donation_lamports,
  coalesce(m.media, '[]'::jsonb) as media
from public.comments c
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'kind', a.kind,
      'public_url', a.public_url,
      'mime_type', a.mime_type,
      'width', a.width,
      'height', a.height,
      'duration_seconds', a.duration_seconds,
      'alt_text', a.alt_text,
      'position', cm.position
    ) order by cm.position, a.created_at
  ) as media
  from public.comment_media cm
  join public.media_assets a on a.id = cm.media_id and a.status = 'published'
  where cm.comment_id = c.id
) m on true;

create or replace function public.publish_post_with_media(
  p_wallet_address text,
  p_nickname text,
  p_body text,
  p_category text,
  p_media_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_post_id bigint;
  media_count integer;
begin
  p_wallet_address := btrim(coalesce(p_wallet_address, ''));
  p_nickname := btrim(coalesce(p_nickname, ''));
  p_body := btrim(coalesce(p_body, ''));
  p_category := lower(btrim(coalesce(p_category, '')));
  p_media_ids := coalesce(p_media_ids, array[]::uuid[]);
  media_count := coalesce(array_length(p_media_ids, 1), 0);

  if p_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    raise exception 'Invalid wallet address';
  end if;
  if char_length(p_nickname) not between 1 and 50 then
    raise exception 'Invalid nickname';
  end if;
  if char_length(p_body) > 5000 or (p_body = '' and media_count = 0) then
    raise exception 'Invalid post body';
  end if;
  if p_category not in ('anything', 'for-fun', 'mutual-aid', 'build', 'animals', 'art') then
    raise exception 'Invalid category';
  end if;
  if media_count > 4 or (
    select count(distinct item.media_id)
    from unnest(p_media_ids) as item(media_id)
  ) <> media_count then
    raise exception 'Invalid media list';
  end if;

  perform 1 from public.profiles pr
  where pr.wallet_address = p_wallet_address;
  if not found then raise exception 'Wallet profile does not exist'; end if;

  if media_count > 0 then
    perform 1 from public.media_assets a
    where a.id = any(p_media_ids)
    order by a.id
    for update;
    if (
      select count(*) from public.media_assets a
      where a.id = any(p_media_ids)
        and a.owner_wallet = p_wallet_address
        and a.status = 'staged'
        and a.expires_at > now()
    ) <> media_count then
      raise exception 'Media is missing, expired, or already published';
    end if;
  end if;

  insert into public.posts (
    author_wallet, nickname, body, category, username, message, "walletAddress"
  ) values (
    p_wallet_address, p_nickname, p_body, p_category, p_nickname,
    case when p_body = '' then '[media]' else p_body end,
    p_wallet_address
  ) returning id into new_post_id;

  if media_count > 0 then
    insert into public.post_media (post_id, media_id, position)
    select new_post_id, item.media_id, item.ordinality::integer - 1
    from unnest(p_media_ids) with ordinality as item(media_id, ordinality);
  end if;

  return jsonb_build_object('id', new_post_id);
end
$$;

create or replace function public.publish_comment_with_media(
  p_wallet_address text,
  p_post_id bigint,
  p_parent_id bigint default null,
  p_nickname text default null,
  p_body text default '',
  p_media_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_comment_id bigint;
  media_count integer;
begin
  p_wallet_address := btrim(coalesce(p_wallet_address, ''));
  p_nickname := btrim(coalesce(p_nickname, ''));
  p_body := btrim(coalesce(p_body, ''));
  p_media_ids := coalesce(p_media_ids, array[]::uuid[]);
  media_count := coalesce(array_length(p_media_ids, 1), 0);

  if p_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    raise exception 'Invalid wallet address';
  end if;
  if char_length(p_nickname) not between 1 and 50 then
    raise exception 'Invalid nickname';
  end if;
  if char_length(p_body) > 5000 or (p_body = '' and media_count = 0) then
    raise exception 'Invalid comment body';
  end if;
  if media_count > 4 or (
    select count(distinct item.media_id)
    from unnest(p_media_ids) as item(media_id)
  ) <> media_count then
    raise exception 'Invalid media list';
  end if;
  if not exists (
    select 1 from public.profiles pr
    where pr.wallet_address = p_wallet_address
  ) then
    raise exception 'Wallet profile does not exist';
  end if;
  if not exists (select 1 from public.posts p where p.id = p_post_id) then
    raise exception 'Post does not exist';
  end if;
  if p_parent_id is not null and not exists (
    select 1 from public.comments c
    where c.id = p_parent_id and c.post_id = p_post_id
  ) then
    raise exception 'Parent comment does not exist on this post';
  end if;

  if media_count > 0 then
    perform 1 from public.media_assets a
    where a.id = any(p_media_ids)
    order by a.id
    for update;
    if (
      select count(*) from public.media_assets a
      where a.id = any(p_media_ids)
        and a.owner_wallet = p_wallet_address
        and a.status = 'staged'
        and a.expires_at > now()
    ) <> media_count then
      raise exception 'Media is missing, expired, or already published';
    end if;
  end if;

  insert into public.comments (
    post_id, parent_id, author_wallet, nickname, body,
    user_id, user_nickname, content
  ) values (
    p_post_id, p_parent_id, p_wallet_address, p_nickname, p_body,
    p_wallet_address, p_nickname,
    case when p_body = '' then '[media]' else p_body end
  ) returning id into new_comment_id;

  if media_count > 0 then
    insert into public.comment_media (comment_id, media_id, position)
    select new_comment_id, item.media_id, item.ordinality::integer - 1
    from unnest(p_media_ids) with ordinality as item(media_id, ordinality);
  end if;

  return jsonb_build_object('id', new_comment_id);
end
$$;

create table if not exists public.wallet_action_windows (
  wallet_address text not null,
  action text not null,
  window_seconds integer not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  primary key (wallet_address, action, window_seconds, window_started_at),
  constraint wallet_action_windows_wallet check (
    wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  ),
  constraint wallet_action_windows_action check (action ~ '^[a-z_]{2,40}$'),
  constraint wallet_action_windows_duration check (window_seconds between 1 and 86400),
  constraint wallet_action_windows_count check (request_count > 0)
);
create index if not exists wallet_action_windows_expiry_idx
  on public.wallet_action_windows (window_started_at);
alter table public.wallet_action_windows enable row level security;
drop policy if exists clients_denied on public.wallet_action_windows;
create policy clients_denied on public.wallet_action_windows
for all to anon, authenticated using (false) with check (false);
revoke all on public.wallet_action_windows from public, anon, authenticated;
grant select, insert, update, delete on public.wallet_action_windows to service_role;

create or replace function public.consume_wallet_rate_limit(
  p_wallet_address text,
  p_action text,
  p_limit integer,
  p_window_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  window_start timestamptz;
  next_count integer;
begin
  p_wallet_address := btrim(coalesce(p_wallet_address, ''));
  p_action := lower(btrim(coalesce(p_action, '')));
  if p_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
     or p_action !~ '^[a-z_]{2,40}$'
     or p_limit is null
     or p_limit not between 1 and 1000
     or p_window_seconds is null
     or p_window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate limit';
  end if;

  window_start := pg_catalog.to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds)
    * p_window_seconds
  );
  insert into public.wallet_action_windows (
    wallet_address, action, window_seconds, window_started_at, request_count
  ) values (
    p_wallet_address, p_action, p_window_seconds, window_start, 1
  )
  on conflict (wallet_address, action, window_seconds, window_started_at)
  do update set request_count = public.wallet_action_windows.request_count + 1
  returning request_count into next_count;

  if next_count > p_limit then
    raise exception 'Wallet action rate limit exceeded';
  end if;

  delete from public.wallet_action_windows
  where wallet_address = p_wallet_address
    and window_started_at < now() - interval '1 day';

  return jsonb_build_object(
    'allowed', true,
    'remaining', p_limit - next_count,
    'resets_at', window_start + make_interval(secs => p_window_seconds)
  );
end
$$;

revoke all on function public.publish_post_with_media(text, text, text, text, uuid[])
  from public, anon, authenticated;
revoke all on function public.publish_comment_with_media(text, bigint, bigint, text, text, uuid[])
  from public, anon, authenticated;
revoke all on function public.consume_wallet_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.enforce_media_asset_hourly_quota()
  from public, anon, authenticated;
revoke all on function public.publish_linked_media_asset()
  from public, anon, authenticated;
grant execute on function public.publish_post_with_media(text, text, text, text, uuid[])
  to service_role;
grant execute on function public.publish_comment_with_media(text, bigint, bigint, text, text, uuid[])
  to service_role;
grant execute on function public.consume_wallet_rate_limit(text, text, integer, integer)
  to service_role;
grant execute on function public.enforce_media_asset_hourly_quota() to service_role;
grant execute on function public.publish_linked_media_asset() to service_role;

commit;
