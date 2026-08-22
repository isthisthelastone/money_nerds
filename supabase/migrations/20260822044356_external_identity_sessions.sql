begin;

-- These two fields are intentionally public: they let the interface distinguish
-- a profile-only proxy from a verified Solana wallet without exposing a subject.
alter table public.profiles
  add column if not exists identity_kind text not null default 'wallet',
  add column if not exists identity_provider text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_identity_kind'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_identity_kind
      check (identity_kind in ('wallet', 'external')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_identity_provider'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_identity_provider check (
      (identity_kind = 'wallet' and identity_provider is null)
      or (
        identity_kind = 'external'
        and identity_provider in ('google', 'apple', 'telegram')
      )
    ) not valid;
  end if;
end
$$;

alter table public.profiles validate constraint profiles_identity_kind;
alter table public.profiles validate constraint profiles_identity_provider;

-- External provider identifiers never enter the public schema. The application
-- stores only a keyed digest plus a deterministic 32-byte base58 profile key.
-- The keyed derivation secret remains server-only and must be kept stable.
create table if not exists internal.external_identity_links (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  subject_hash text not null,
  proxy_wallet_address text not null references public.profiles(wallet_address)
    on update cascade on delete restrict,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint external_identity_links_provider check (
    provider in ('google', 'apple', 'telegram')
  ),
  constraint external_identity_links_subject_hash check (
    subject_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint external_identity_links_proxy_shape check (
    proxy_wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  ),
  unique (provider, subject_hash),
  unique (proxy_wallet_address)
);

alter table internal.external_identity_links enable row level security;
drop policy if exists clients_denied on internal.external_identity_links;
create policy clients_denied on internal.external_identity_links
for all to anon, authenticated using (false) with check (false);
revoke all on internal.external_identity_links from public, anon, authenticated;
grant select, insert, update, delete on internal.external_identity_links to service_role;

alter table public.wallet_sessions
  add column if not exists auth_provider text not null default 'wallet',
  add column if not exists external_identity_link_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wallet_sessions_auth_provider'
      and conrelid = 'public.wallet_sessions'::regclass
  ) then
    alter table public.wallet_sessions
      add constraint wallet_sessions_auth_provider
      check (auth_provider in ('wallet', 'google', 'apple', 'telegram')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'wallet_sessions_external_identity_fk'
      and conrelid = 'public.wallet_sessions'::regclass
  ) then
    alter table public.wallet_sessions
      add constraint wallet_sessions_external_identity_fk
      foreign key (external_identity_link_id)
      references internal.external_identity_links(id)
      on update cascade on delete restrict not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'wallet_sessions_identity_consistency'
      and conrelid = 'public.wallet_sessions'::regclass
  ) then
    alter table public.wallet_sessions
      add constraint wallet_sessions_identity_consistency check (
        (auth_provider = 'wallet' and external_identity_link_id is null)
        or (auth_provider <> 'wallet' and external_identity_link_id is not null)
      ) not valid;
  end if;
end
$$;

alter table public.wallet_sessions validate constraint wallet_sessions_auth_provider;
alter table public.wallet_sessions validate constraint wallet_sessions_external_identity_fk;
alter table public.wallet_sessions validate constraint wallet_sessions_identity_consistency;

create index if not exists external_identity_links_profile_idx
  on internal.external_identity_links (proxy_wallet_address);
create index if not exists wallet_sessions_external_identity_idx
  on public.wallet_sessions (external_identity_link_id, expires_at desc)
  where external_identity_link_id is not null;

-- Append public-safe identity semantics to the existing read contracts. Existing
-- view column positions stay unchanged for PostgREST consumers.
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
  p.view_count,
  author_profile.identity_kind as author_identity_kind,
  author_profile.identity_provider as author_identity_provider
from public.posts p
join public.profiles author_profile
  on author_profile.wallet_address = p.author_wallet
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
  coalesce(m.media, '[]'::jsonb) as media,
  author_profile.identity_kind as author_identity_kind,
  author_profile.identity_provider as author_identity_provider
from public.comments c
left join public.profiles author_profile
  on author_profile.wallet_address = c.author_wallet
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

create or replace function public.establish_external_session(
  p_provider text,
  p_subject_hash text,
  p_proxy_wallet_address text,
  p_token_hash text,
  p_session_expires_at timestamptz,
  p_previous_token_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_id uuid;
  session_wallet text;
  profile_kind text;
  profile_provider text;
begin
  p_provider := lower(btrim(coalesce(p_provider, '')));
  p_subject_hash := lower(btrim(coalesce(p_subject_hash, '')));
  p_proxy_wallet_address := btrim(coalesce(p_proxy_wallet_address, ''));
  p_token_hash := lower(btrim(coalesce(p_token_hash, '')));
  p_previous_token_hash := nullif(lower(btrim(coalesce(p_previous_token_hash, ''))), '');

  if p_provider not in ('google', 'apple', 'telegram') then
    raise exception 'Invalid external authentication provider';
  end if;
  if p_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid external identity digest';
  end if;
  if p_proxy_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    raise exception 'Invalid external profile address';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$'
     or (p_previous_token_hash is not null and p_previous_token_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'Session token hash must be a SHA-256 hex digest';
  end if;
  if p_session_expires_at <= now()
     or p_session_expires_at > now() + interval '30 days' then
    raise exception 'Session expiration must be within 30 days';
  end if;

  insert into public.profiles (
    wallet_address, identity_kind, identity_provider
  ) values (
    p_proxy_wallet_address, 'external', p_provider
  )
  on conflict (wallet_address) do nothing;

  select pr.identity_kind, pr.identity_provider
  into profile_kind, profile_provider
  from public.profiles pr
  where pr.wallet_address = p_proxy_wallet_address;
  if profile_kind <> 'external' or profile_provider <> p_provider then
    raise exception 'External profile address collision';
  end if;

  insert into internal.external_identity_links (
    provider, subject_hash, proxy_wallet_address, last_seen_at
  ) values (
    p_provider, p_subject_hash, p_proxy_wallet_address, now()
  )
  on conflict (provider, subject_hash) do update
    set last_seen_at = excluded.last_seen_at
  returning id, proxy_wallet_address into link_id, session_wallet;

  if session_wallet <> p_proxy_wallet_address then
    raise exception 'External identity derivation does not match its existing profile';
  end if;

  -- Payout destinations are opt-in verified Solana wallets. If the payout
  -- registry migration ran first, remove only an erroneously auto-seeded
  -- self-address payout. A separately verified payout wallet remains valid.
  if to_regclass('public.verified_payout_accounts') is not null then
    execute $statement$
      delete from public.verified_payout_accounts
      where profile_wallet = $1 and normalized_address = $1
    $statement$
      using session_wallet;
  end if;
  if to_regclass('internal.payout_account_proofs') is not null then
    execute $statement$
      update internal.payout_account_proofs
      set revoked_at = coalesce(revoked_at, now())
      where profile_wallet = $1
        and normalized_address = $1
        and verification_method = 'legacy_profile_migration'
    $statement$ using session_wallet;
  end if;

  insert into public.wallet_sessions (
    token_hash, wallet_address, expires_at, revoked_at,
    auth_provider, external_identity_link_id
  ) values (
    p_token_hash, session_wallet, p_session_expires_at, null,
    p_provider, link_id
  );

  if p_previous_token_hash is not null and p_previous_token_hash <> p_token_hash then
    update public.wallet_sessions
    set revoked_at = now()
    where token_hash = p_previous_token_hash and revoked_at is null;
  end if;

  return jsonb_build_object(
    'wallet_address', session_wallet,
    'expires_at', p_session_expires_at,
    'auth_provider', p_provider
  );
end
$$;

create or replace function public.get_wallet_session(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_wallet text;
  session_expiry timestamptz;
  session_provider text;
begin
  p_token_hash := lower(btrim(p_token_hash));
  if p_token_hash !~ '^[0-9a-f]{64}$' then return null; end if;

  update public.wallet_sessions s
  set last_seen_at = now()
  where s.token_hash = p_token_hash
    and s.revoked_at is null
    and s.expires_at > now()
  returning s.wallet_address, s.expires_at, s.auth_provider
  into session_wallet, session_expiry, session_provider;

  if session_wallet is null then return null; end if;
  return jsonb_build_object(
    'wallet_address', session_wallet,
    'expires_at', session_expiry,
    'auth_provider', session_provider
  );
end
$$;

create or replace function public.is_external_proxy_wallet(p_wallet_address text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from internal.external_identity_links link
    where link.proxy_wallet_address = btrim(coalesce(p_wallet_address, ''))
  )
$$;

create or replace function internal.reject_external_proxy_donation_intent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from internal.external_identity_links link
    where link.proxy_wallet_address in (new.donor_wallet, new.recipient_wallet)
  ) then
    raise exception 'External profile proxies cannot send or receive Solana donations';
  end if;
  return new;
end
$$;

drop trigger if exists reject_external_proxy_donation_intent on public.donation_intents;
create trigger reject_external_proxy_donation_intent
before insert or update of donor_wallet, recipient_wallet on public.donation_intents
for each row execute function internal.reject_external_proxy_donation_intent();

revoke all on function public.establish_external_session(text, text, text, text, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.is_external_proxy_wallet(text)
  from public, anon, authenticated;
revoke all on function internal.reject_external_proxy_donation_intent()
  from public, anon, authenticated;
revoke all on function public.get_wallet_session(text)
  from public, anon, authenticated;
grant execute on function public.establish_external_session(text, text, text, text, timestamptz, text)
  to service_role;
grant execute on function public.is_external_proxy_wallet(text)
  to service_role;
grant execute on function public.get_wallet_session(text)
  to service_role;

commit;
