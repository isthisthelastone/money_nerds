-- Recipient contact data never enters public profiles, feed RPCs or public grants.
create or replace function internal.valid_sbp_banks(p_banks jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare
  item jsonb;
  bank_id text;
  link text;
  seen text[] := array[]::text[];
begin
  if p_banks is null or jsonb_typeof(p_banks) <> 'array' then return false; end if;
  if jsonb_array_length(p_banks) > 12 then return false; end if;
  for item in select value from jsonb_array_elements(p_banks) loop
    if jsonb_typeof(item) <> 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(item) k where k not in ('bankId', 'transferUrl')) then return false; end if;
    bank_id := item ->> 'bankId';
    if bank_id is null or bank_id not in ('sber', 'tbank', 'alfa', 'ozon', 'vtb', 'gazprom', 'raiffeisen', 'sovcom', 'psb', 'akbars', 'yandex', 'mts')
      or bank_id = any(seen) then return false; end if;
    seen := array_append(seen, bank_id);
    if item ? 'transferUrl' and jsonb_typeof(item -> 'transferUrl') not in ('string', 'null') then return false; end if;
    link := item ->> 'transferUrl';
    if link is not null then
      if length(link) > 1024 or link ~ '[[:space:][:cntrl:]?#\\]' or link ~* '%(2f|5c|2e|25)' or link ~ '/\.{1,2}(/|$)' then return false; end if;
      if not (
        (bank_id = 'alfa' and link ~ '^https://web\.alfabank\.ru/public/mrv2/[^/]+/?$') or
        (bank_id = 'tbank' and link ~ '^https://(www\.)?tbank\.ru/collectmoney/crowd/[^/]+/[^/]+/?$')
      ) then return false; end if;
    end if;
  end loop;
  return true;
end;
$$;
revoke all on function internal.valid_sbp_banks(jsonb) from public, anon, authenticated;
grant usage on schema internal to service_role;
grant execute on function internal.valid_sbp_banks(jsonb) to service_role;

create table public.profile_sbp_settings (
  wallet_address text primary key references public.profiles(wallet_address) on delete cascade,
  enabled boolean not null default false,
  phone text check (phone is null or phone ~ '^\+7[0-9]{10}$'),
  banks jsonb not null default '[]'::jsonb check (internal.valid_sbp_banks(banks)),
  updated_at timestamptz not null default now(),
  constraint sbp_disabled_has_no_contact check (enabled or (phone is null and banks = '[]'::jsonb)),
  constraint sbp_receiving_banks_need_phone check (banks = '[]'::jsonb or phone is not null)
);
create table public.post_sbp_options (
  post_id bigint primary key references public.posts(id) on delete cascade,
  author_wallet text not null references public.profiles(wallet_address) on delete cascade,
  phone text not null check (phone ~ '^\+7[0-9]{10}$'),
  banks jsonb not null check (internal.valid_sbp_banks(banks) and jsonb_array_length(banks) > 0),
  created_at timestamptz not null default now()
);
create index post_sbp_options_author_idx on public.post_sbp_options(author_wallet);
alter table public.profile_sbp_settings enable row level security;
alter table public.post_sbp_options enable row level security;
-- Explicit browser denial in addition to revoked grants. The server's APIs bind
-- the canonical profile to the verified Clerk session; service_role bypasses RLS.
create policy profile_sbp_browser_deny on public.profile_sbp_settings
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy post_sbp_browser_deny on public.post_sbp_options
  as restrictive for all to anon, authenticated using (false) with check (false);
revoke all on public.profile_sbp_settings, public.post_sbp_options from public, anon, authenticated;
grant select, insert, update, delete on public.profile_sbp_settings, public.post_sbp_options to service_role;
comment on table public.profile_sbp_settings is 'Private opt-in SBP preferences. Never expose through public profile/feed views.';
comment on table public.post_sbp_options is 'Private recipient snapshots. Visible only through server-side both-party opt-in checks.';

create or replace function public.save_sbp_settings(p_wallet_address text, p_enabled boolean, p_phone text, p_banks jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_enabled is null then raise exception 'Invalid SBP setting'; end if;
  if not p_enabled then p_phone := null; p_banks := '[]'::jsonb; end if;
  insert into public.profile_sbp_settings(wallet_address, enabled, phone, banks)
  values (p_wallet_address, p_enabled, p_phone, p_banks)
  on conflict (wallet_address) do update
    set enabled = excluded.enabled, phone = excluded.phone, banks = excluded.banks, updated_at = now();
  if not p_enabled then
    -- Revocation and contact erasure are atomic. Re-enabling cannot resurrect a
    -- previous post's recipient details or bank collection link.
    delete from public.post_sbp_options where author_wallet = p_wallet_address;
  end if;
end;
$$;
revoke all on function public.save_sbp_settings(text, boolean, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_sbp_settings(text, boolean, text, jsonb) to service_role;

create or replace function public.publish_post_with_sbp(
  p_wallet_address text, p_nickname text, p_body text, p_category text,
  p_media_ids uuid[] default array[]::uuid[], p_funding_options jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  settings public.profile_sbp_settings%rowtype;
  published jsonb;
  new_post_id bigint;
begin
  -- Serialize against preference changes so a concurrent disable cannot leave
  -- newly published contact data behind after revocation has completed.
  select * into settings from public.profile_sbp_settings
    where wallet_address = p_wallet_address for share;
  if not found or not settings.enabled or settings.phone is null or jsonb_array_length(settings.banks) = 0 then
    raise exception 'SBP recipient settings are not ready';
  end if;
  published := public.publish_post_with_media(p_wallet_address, p_nickname, p_body, p_category, p_media_ids, p_funding_options);
  new_post_id := (published ->> 'id')::bigint;
  insert into public.post_sbp_options(post_id, author_wallet, phone, banks)
    values(new_post_id, p_wallet_address, settings.phone, settings.banks);
  if coalesce(jsonb_array_length(p_funding_options), 0) = 0 then
    -- Explicit SBP-only publication must not inherit a legacy synthetic SOL route.
    delete from public.post_funding_options where post_id = new_post_id;
    published := published || jsonb_build_object('funding_option_count', 0);
  end if;
  return published;
end;
$$;
revoke all on function public.publish_post_with_sbp(text, text, text, text, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.publish_post_with_sbp(text, text, text, text, uuid[], jsonb) to service_role;

create or replace function public.get_post_sbp_transfer(p_post_id bigint, p_viewer_wallet text, p_bank_id text default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  recipient public.post_sbp_options%rowtype;
  selected_bank jsonb;
begin
  select option.* into recipient from public.post_sbp_options option
    join public.posts post on post.id = option.post_id and post.author_wallet = option.author_wallet
    join public.profile_sbp_settings author on author.wallet_address = option.author_wallet and author.enabled
    join public.profile_sbp_settings viewer on viewer.wallet_address = p_viewer_wallet and viewer.enabled
    where option.post_id = p_post_id;
  if not found then return null; end if;
  if p_bank_id is null then
    return jsonb_build_object('available', true, 'banks', (
      select jsonb_agg(jsonb_build_object('bankId', bank ->> 'bankId', 'hasLink', (bank ->> 'transferUrl') is not null))
      from jsonb_array_elements(recipient.banks) bank
    ));
  end if;
  select bank into selected_bank from jsonb_array_elements(recipient.banks) bank where bank ->> 'bankId' = p_bank_id;
  if selected_bank is null then return null; end if;
  return jsonb_build_object('bankId', p_bank_id, 'phone', recipient.phone, 'transferUrl', selected_bank ->> 'transferUrl');
end;
$$;
revoke all on function public.get_post_sbp_transfer(bigint, text, text) from public, anon, authenticated;
grant execute on function public.get_post_sbp_transfer(bigint, text, text) to service_role;
