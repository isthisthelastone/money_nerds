begin;

-- Keep the established slugs so stored posts and shared category URLs remain
-- compatible. `anything` continues to mean the unfiltered feed in application
-- queries and remains readable for legacy posts, but new posts must use a real
-- category and default to `other`.
alter table public.posts alter column category set default 'other';

alter table public.posts
  add constraint posts_category_taxonomy check (
    category in (
      'anything',
      'for-fun',
      'memes',
      'mutual-aid',
      'build',
      'animals',
      'art',
      'crowdfunding',
      'other'
    )
  ) not valid;

alter table public.posts validate constraint posts_category_taxonomy;

alter table public.posts drop constraint posts_category_length;

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
  if p_category not in (
    'for-fun',
    'memes',
    'mutual-aid',
    'build',
    'animals',
    'art',
    'crowdfunding',
    'other'
  ) then
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

revoke all on function public.publish_post_with_media(text, text, text, text, uuid[])
  from public, anon, authenticated;
grant execute on function public.publish_post_with_media(text, text, text, text, uuid[])
  to service_role;

commit;
