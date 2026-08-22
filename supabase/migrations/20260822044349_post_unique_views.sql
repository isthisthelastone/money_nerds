begin;

-- Count people, not raw requests. The application supplies a one-way hash of
-- either the authenticated wallet or a private, HttpOnly browser identifier.
-- Viewer identifiers are never exposed through the public API.
alter table public.posts
  add column if not exists view_count bigint not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'posts_view_count_nonnegative'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_view_count_nonnegative check (view_count >= 0);
  end if;
end
$$;

create table if not exists public.post_views (
  post_id bigint not null references public.posts(id) on delete cascade,
  viewer_hash text not null,
  first_viewed_at timestamptz not null default now(),
  primary key (post_id, viewer_hash),
  constraint post_views_hash_shape check (viewer_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists post_views_first_viewed_idx
  on public.post_views (first_viewed_at);

alter table public.post_views enable row level security;
drop policy if exists clients_denied on public.post_views;
create policy clients_denied on public.post_views
for all to anon, authenticated using (false) with check (false);
revoke all on public.post_views from public, anon, authenticated;
grant select, insert, delete on public.post_views to service_role;

create or replace function public.record_unique_post_view(
  p_post_id bigint,
  p_viewer_hash text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
  current_count bigint;
begin
  if p_post_id is null
     or p_post_id <= 0
     or p_viewer_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid post view';
  end if;

  select p.view_count into current_count
  from public.posts p
  where p.id = p_post_id;
  if current_count is null then
    raise exception 'Post not found';
  end if;

  insert into public.post_views (post_id, viewer_hash)
  values (p_post_id, p_viewer_hash)
  on conflict (post_id, viewer_hash) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    update public.posts
    set view_count = view_count + 1
    where id = p_post_id
    returning view_count into current_count;
  else
    -- A concurrent first view can win the unique-key race after the initial
    -- count was read. Read again after ON CONFLICT resolves so this request
    -- never returns the stale pre-increment value to the client.
    select p.view_count into current_count
    from public.posts p
    where p.id = p_post_id;
  end if;
  return current_count;
end
$$;

revoke all on function public.record_unique_post_view(bigint, text)
  from public, anon, authenticated;
grant execute on function public.record_unique_post_view(bigint, text)
  to service_role;

-- Preserve the current public read contract and append the new field so
-- CREATE OR REPLACE VIEW remains compatible with existing column positions.
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
  coalesce(m.media, '[]'::jsonb) as media,
  p.view_count
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

commit;
