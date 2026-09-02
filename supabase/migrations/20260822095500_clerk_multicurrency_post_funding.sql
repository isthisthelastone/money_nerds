begin;

-- Clerk remains the authentication authority. Money Nerds keeps a durable,
-- private mapping from Clerk's user id to the existing public profile key. The
-- profile key is an opaque, server-derived 32-byte base58 value for Clerk-only
-- users; it must never be treated as a Solana payout address.
do $$
begin
  perform set_config(
    'money_nerds.pre_profiles',
    (select count(*)::text from public.profiles),
    true
  );
  perform set_config(
    'money_nerds.pre_posts',
    (select count(*)::text from public.posts),
    true
  );
  perform set_config(
    'money_nerds.pre_comments',
    (select count(*)::text from public.comments),
    true
  );
  perform set_config(
    'money_nerds.pre_donations',
    (select count(*)::text from public.donations),
    true
  );
  perform set_config(
    'money_nerds.pre_legacy_donations',
    (select count(*)::text from public.legacy_unverified_donations),
    true
  );
end
$$;

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add constraint profiles_avatar_url check (
    avatar_url is null
    or (
      char_length(avatar_url) between 8 and 2048
      and avatar_url ~* '^https://'
    )
  ) not valid;
alter table public.profiles validate constraint profiles_avatar_url;

-- Clerk is a profile identity provider, not a chain wallet provider.
alter table public.profiles drop constraint profiles_identity_provider;
alter table public.profiles add constraint profiles_identity_provider check (
  (identity_kind = 'wallet' and identity_provider is null)
  or (
    identity_kind = 'external'
    and identity_provider in ('google', 'apple', 'telegram', 'clerk')
  )
) not valid;
alter table public.profiles validate constraint profiles_identity_provider;

create table internal.clerk_profile_links (
  clerk_user_id text primary key,
  profile_wallet text not null unique references public.profiles(wallet_address)
    on update cascade on delete restrict,
  binding_kind text not null,
  clerk_created_at timestamptz,
  clerk_updated_at timestamptz not null,
  last_synced_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint clerk_profile_links_user_id check (
    clerk_user_id ~ '^user_[A-Za-z0-9_-]{3,190}$'
  ),
  constraint clerk_profile_links_binding_kind check (
    binding_kind in (
      'clerk_proxy', 'legacy_session', 'verified_wallet', 'verified_external'
    )
  ),
  constraint clerk_profile_links_timestamps check (
    clerk_created_at is null or clerk_created_at <= clerk_updated_at
  ),
  constraint clerk_profile_links_deletion_time check (
    deleted_at is null or deleted_at >= clerk_updated_at
  )
);

create index clerk_profile_links_active_profile_idx
  on internal.clerk_profile_links (profile_wallet)
  where deleted_at is null;

alter table internal.clerk_profile_links enable row level security;
create policy clients_denied on internal.clerk_profile_links
for all to anon, authenticated using (false) with check (false);
revoke all on internal.clerk_profile_links from public, anon, authenticated;
grant select, insert, update, delete on internal.clerk_profile_links to service_role;

-- Extend the existing proxy predicate so every proof and legacy-donation guard
-- also recognizes Clerk's opaque profile keys.
create or replace function internal.is_external_proxy_profile(p_profile_wallet text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  social_proxy boolean := false;
begin
  if exists (
    select 1
    from internal.clerk_profile_links link
    where link.profile_wallet = btrim(coalesce(p_profile_wallet, ''))
      and link.binding_kind = 'clerk_proxy'
  ) then
    return true;
  end if;

  if to_regclass('internal.external_identity_links') is not null then
    execute 'select exists (
      select 1 from internal.external_identity_links
      where proxy_wallet_address = $1
    )'
    into social_proxy
    using btrim(coalesce(p_profile_wallet, ''));
  end if;
  return social_proxy;
end
$$;

create or replace function public.is_external_proxy_wallet(p_wallet_address text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select internal.is_external_proxy_profile(p_wallet_address)
$$;

create or replace function internal.reject_external_proxy_donation_intent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if internal.is_external_proxy_profile(new.donor_wallet)
     or internal.is_external_proxy_profile(new.recipient_wallet) then
    raise exception 'External profile proxies cannot send or receive legacy Solana donations';
  end if;
  return new;
end
$$;

revoke all on function internal.is_external_proxy_profile(text)
  from public, anon, authenticated;
revoke all on function public.is_external_proxy_wallet(text)
  from public, anon, authenticated;
revoke all on function internal.reject_external_proxy_donation_intent()
  from public, anon, authenticated;
grant execute on function internal.is_external_proxy_profile(text) to service_role;
grant execute on function public.is_external_proxy_wallet(text) to service_role;

-- Exact mainnet asset registry. Atomic amounts are never combined across asset
-- or network boundaries. Token contracts are snapshots used by transaction
-- verifiers and must be matched exactly.
create table public.funding_assets (
  asset text primary key,
  symbol text not null,
  chain_namespace text not null,
  network_reference text not null,
  network_name text not null,
  decimals smallint not null,
  asset_kind text not null,
  token_standard text,
  token_contract text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint funding_assets_asset_shape check (
    asset ~ '^[A-Z0-9]+(?:-[A-Z0-9]+)*$'
    and char_length(asset) between 2 and 32
  ),
  constraint funding_assets_symbol_shape check (
    symbol ~ '^[A-Z0-9]{2,12}$'
  ),
  constraint funding_assets_namespace_length check (
    char_length(chain_namespace) between 2 and 16
  ),
  constraint funding_assets_network_length check (
    char_length(network_reference) between 1 and 64
  ),
  constraint funding_assets_network_name_length check (
    char_length(network_name) between 2 and 80
  ),
  constraint funding_assets_decimals check (decimals between 0 and 30),
  constraint funding_assets_kind check (asset_kind in ('native', 'token')),
  constraint funding_assets_token_shape check (
    (
      asset_kind = 'native'
      and token_standard is null
      and token_contract is null
    )
    or (
      asset_kind = 'token'
      and token_standard in ('SPL', 'ERC20', 'TRC20')
      and char_length(token_contract) between 10 and 128
    )
  ),
  unique (asset, chain_namespace, network_reference)
);

insert into public.funding_assets (
  asset, symbol, chain_namespace, network_reference, network_name,
  decimals, asset_kind, token_standard, token_contract
) values
  (
    'SOL', 'SOL', 'solana', '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    'Solana Mainnet', 9, 'native', null, null
  ),
  (
    'USDC-SOL', 'USDC', 'solana', '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    'Solana Mainnet', 6, 'token', 'SPL',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  ),
  (
    'USDT-SOL', 'USDT', 'solana', '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    'Solana Mainnet', 6, 'token', 'SPL',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  ),
  (
    'ETH', 'ETH', 'eip155', '1', 'Ethereum Mainnet',
    18, 'native', null, null
  ),
  (
    'USDT-ERC20', 'USDT', 'eip155', '1', 'Ethereum Mainnet',
    6, 'token', 'ERC20', '0xdac17f958d2ee523a2206206994597c13d831ec7'
  ),
  (
    'BTC', 'BTC', 'bip122', '000000000019d6689c085ae165831e93',
    'Bitcoin Mainnet', 8, 'native', null, null
  ),
  (
    'TRX', 'TRX', 'tron', '0x2b6653dc', 'TRON Mainnet',
    6, 'native', null, null
  ),
  (
    'USDT-TRC20', 'USDT', 'tron', '0x2b6653dc', 'TRON Mainnet',
    6, 'token', 'TRC20', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
  ),
  (
    'TON', 'TON', 'ton', '-239', 'TON Mainnet',
    9, 'native', null, null
  ),
  (
    'INJ', 'INJ', 'cosmos', 'injective-1', 'Injective Mainnet',
    18, 'native', null, null
  );

create or replace function internal.is_supported_funding_route(
  p_chain_namespace text,
  p_network_reference text,
  p_asset text,
  p_recipient_address text
)
returns boolean
language sql
immutable
returns null on null input
set search_path = ''
as $$
  select case
    when p_chain_namespace = 'cosmos'
      and p_network_reference = 'injective-1'
      then p_asset = 'INJ'
        and p_recipient_address ~ '^inj1[0-9a-z]{38}$'
    else internal.is_supported_payout_address(
      p_chain_namespace, p_network_reference, p_recipient_address
    ) and case
    when p_chain_namespace = 'solana'
      and p_network_reference = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
      then p_asset in ('SOL', 'USDC-SOL', 'USDT-SOL')
    when p_chain_namespace = 'eip155' and p_network_reference = '1'
      then p_asset in ('ETH', 'USDT-ERC20')
    when p_chain_namespace = 'bip122'
      and p_network_reference = '000000000019d6689c085ae165831e93'
      then p_asset = 'BTC'
    when p_chain_namespace = 'tron' and p_network_reference = '0x2b6653dc'
      then p_asset in ('TRX', 'USDT-TRC20')
    when p_chain_namespace = 'ton' and p_network_reference = '-239'
      then p_asset = 'TON'
    else false
    end
  end
$$;

create or replace function internal.is_supported_funding_transaction_hash(
  p_chain_namespace text,
  p_network_reference text,
  p_transaction_hash text
)
returns boolean
language sql
immutable
returns null on null input
set search_path = ''
as $$
  select case
    when p_chain_namespace = 'solana'
      and p_network_reference = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
      then p_transaction_hash ~ '^[1-9A-HJ-NP-Za-km-z]{80,90}$'
    when p_chain_namespace = 'eip155'
      and p_network_reference = '1'
      then p_transaction_hash ~ '^0x[0-9a-f]{64}$'
    when p_chain_namespace = 'cosmos'
      and p_network_reference = 'injective-1'
      then p_transaction_hash ~ '^[0-9a-f]{64}$'
    when p_chain_namespace = 'bip122'
      and p_network_reference = '000000000019d6689c085ae165831e93'
      then p_transaction_hash ~ '^[0-9a-f]{64}$'
    when p_chain_namespace = 'tron' and p_network_reference = '0x2b6653dc'
      then p_transaction_hash ~ '^[0-9a-f]{64}$'
    when p_chain_namespace = 'ton' and p_network_reference = '-239'
      then p_transaction_hash ~ '^[0-9a-f]{64}$'
        or p_transaction_hash ~ '^[A-Za-z0-9_-]{43}$'
        or p_transaction_hash ~ '^[A-Za-z0-9+/]{43}=$'
    else false
  end
$$;

-- Reusable profile routes are public-safe, service-written records. A route may
-- be self-declared after strict server-side syntax/checksum validation; ownership
-- verification can promote it later without blocking post or comment creation.
create table public.profile_funding_routes (
  id uuid primary key default gen_random_uuid(),
  profile_wallet text not null references public.profiles(wallet_address)
    on update cascade on delete cascade,
  asset text not null references public.funding_assets(asset)
    on update cascade on delete restrict,
  chain_namespace text not null,
  network_reference text not null,
  recipient_address text not null,
  verification_status text not null default 'self_declared',
  verification_method text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_funding_routes_route check (
    internal.is_supported_funding_route(
      chain_namespace, network_reference, asset, recipient_address
    )
  ),
  constraint profile_funding_routes_status check (
    verification_status in (
      'self_declared', 'pending', 'verified', 'rejected', 'revoked'
    )
  ),
  constraint profile_funding_routes_method check (
    verification_method is null
    or verification_method ~ '^[a-z][a-z0-9_]{2,63}$'
  ),
  constraint profile_funding_routes_verified_shape check (
    verification_status <> 'verified' or verified_at is not null
  ),
  unique (profile_wallet, asset),
  foreign key (asset, chain_namespace, network_reference)
    references public.funding_assets(asset, chain_namespace, network_reference)
    on update cascade on delete restrict
);

create index profile_funding_routes_address_idx
  on public.profile_funding_routes (
    chain_namespace, network_reference, recipient_address
  );

-- Import one current proof-backed route per profile and asset. The same verified
-- Solana owner address safely receives native SOL, canonical USDC, and canonical
-- USDT; token mint addresses remain pinned in funding_assets.
insert into public.profile_funding_routes (
  profile_wallet, asset, chain_namespace, network_reference,
  recipient_address, verification_status, verification_method, verified_at
)
select distinct on (account.profile_wallet, account.asset)
  account.profile_wallet,
  account.asset,
  account.chain_namespace,
  account.network_reference,
  account.normalized_address,
  'verified',
  'verified_payout_account',
  account.verified_at
from public.verified_payout_accounts account
join public.funding_assets asset
  on asset.asset = account.asset
 and asset.chain_namespace = account.chain_namespace
 and asset.network_reference = account.network_reference
order by account.profile_wallet, account.asset, account.verified_at desc, account.id
on conflict (profile_wallet, asset) do nothing;

insert into public.profile_funding_routes (
  profile_wallet, asset, chain_namespace, network_reference,
  recipient_address, verification_status, verification_method, verified_at
)
select
  sol.profile_wallet,
  token.asset,
  sol.chain_namespace,
  sol.network_reference,
  sol.recipient_address,
  'verified',
  'verified_solana_owner',
  sol.verified_at
from public.profile_funding_routes sol
cross join (values ('USDC-SOL'::text), ('USDT-SOL'::text)) token(asset)
where sol.asset = 'SOL'
  and sol.verification_status = 'verified'
on conflict (profile_wallet, asset) do nothing;

-- Post options are independent address snapshots. They never require an entry in
-- verified_payout_accounts. profile_funding_route_id records reuse provenance but
-- is nullable and uses ON DELETE SET NULL so a post's historic choice survives.
create table public.post_funding_options (
  id uuid primary key default gen_random_uuid(),
  post_id bigint not null references public.posts(id) on delete cascade,
  profile_wallet text not null references public.profiles(wallet_address)
    on update cascade on delete restrict,
  asset text not null references public.funding_assets(asset)
    on update cascade on delete restrict,
  chain_namespace text not null,
  network_reference text not null,
  recipient_address text not null,
  verification_status text not null default 'self_declared',
  source text not null default 'explicit_post',
  profile_funding_route_id uuid references public.profile_funding_routes(id)
    on update restrict on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_funding_options_route check (
    internal.is_supported_funding_route(
      chain_namespace, network_reference, asset, recipient_address
    )
  ),
  constraint post_funding_options_status check (
    verification_status in (
      'self_declared', 'pending', 'verified', 'rejected', 'revoked'
    )
  ),
  constraint post_funding_options_source check (
    source in ('explicit_post', 'profile_saved', 'legacy_seed')
  ),
  unique (post_id, asset),
  foreign key (asset, chain_namespace, network_reference)
    references public.funding_assets(asset, chain_namespace, network_reference)
    on update cascade on delete restrict
);

create index post_funding_options_profile_idx
  on public.post_funding_options (profile_wallet, asset, post_id);
create index post_funding_options_address_idx
  on public.post_funding_options (
    chain_namespace, network_reference, recipient_address
  );

create or replace function internal.touch_profile_funding_route()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'profile_funding_routes'
     and old.verification_status = 'verified'
     and new.verification_status = 'verified'
     and (
       new.asset is distinct from old.asset
       or new.chain_namespace is distinct from old.chain_namespace
       or new.network_reference is distinct from old.network_reference
       or new.recipient_address is distinct from old.recipient_address
     ) then
    raise exception 'A changed payout address must be re-verified or marked self-declared';
  end if;
  if tg_table_name = 'post_funding_options'
     and old.verification_status = 'verified'
     and new.verification_status = 'verified'
     and (
       new.asset is distinct from old.asset
       or new.chain_namespace is distinct from old.chain_namespace
       or new.network_reference is distinct from old.network_reference
       or new.recipient_address is distinct from old.recipient_address
     ) then
    raise exception 'A changed post destination must be re-verified or marked self-declared';
  end if;
  new.updated_at := now();
  return new;
end
$$;

create or replace function internal.assert_post_funding_option()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_profile text;
  saved public.profile_funding_routes%rowtype;
begin
  select post.author_wallet into expected_profile
  from public.posts post where post.id = new.post_id;
  if expected_profile is null then
    raise exception 'Funding option post does not exist';
  end if;
  if new.profile_wallet <> expected_profile then
    raise exception 'Post funding destination must belong to the post author profile';
  end if;

  if new.profile_funding_route_id is not null then
    select route.* into saved
    from public.profile_funding_routes route
    where route.id = new.profile_funding_route_id;
    if not found
       or saved.profile_wallet <> new.profile_wallet
       or saved.asset <> new.asset
       or saved.chain_namespace <> new.chain_namespace
       or saved.network_reference <> new.network_reference
       or saved.recipient_address <> new.recipient_address then
      raise exception 'Saved payout route does not match the post funding snapshot';
    end if;
  end if;
  return new;
end
$$;

create or replace function internal.seed_post_funding_options()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.post_funding_options (
    post_id, profile_wallet, asset, chain_namespace, network_reference,
    recipient_address, verification_status, source,
    profile_funding_route_id
  )
  select
    new.id,
    route.profile_wallet,
    route.asset,
    route.chain_namespace,
    route.network_reference,
    route.recipient_address,
    route.verification_status,
    'profile_saved',
    route.id
  from public.profile_funding_routes route
  where route.profile_wallet = new.author_wallet
    and route.verification_status in ('self_declared', 'verified')
  on conflict (post_id, asset) do nothing;
  return new;
end
$$;

create or replace function internal.protect_post_funding_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.author_wallet is distinct from old.author_wallet and exists (
    select 1
    from public.post_funding_options option
    where option.post_id = old.id
      and option.profile_wallet <> new.author_wallet
  ) then
    raise exception 'Remove or replace post funding options before changing its author';
  end if;
  return new;
end
$$;

create or replace function internal.sync_saved_route_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.post_funding_options option
    set verification_status = 'revoked'
    where option.profile_funding_route_id = old.id;
    return old;
  end if;

  if new.asset is distinct from old.asset
     or new.chain_namespace is distinct from old.chain_namespace
     or new.network_reference is distinct from old.network_reference
     or new.recipient_address is distinct from old.recipient_address then
    update public.post_funding_options option
    set profile_funding_route_id = null
    where option.profile_funding_route_id = old.id;
  elsif new.verification_status is distinct from old.verification_status then
    update public.post_funding_options option
    set verification_status = new.verification_status
    where option.profile_funding_route_id = old.id;
  end if;
  return new;
end
$$;

create trigger profile_funding_routes_touch_updated_at
before update on public.profile_funding_routes
for each row execute function internal.touch_profile_funding_route();

create trigger post_funding_options_touch_updated_at
before update on public.post_funding_options
for each row execute function internal.touch_profile_funding_route();

create trigger post_funding_options_validate_owner
before insert or update on public.post_funding_options
for each row execute function internal.assert_post_funding_option();

create trigger posts_seed_funding_options
after insert on public.posts
for each row execute function internal.seed_post_funding_options();

create trigger posts_protect_funding_owner
before update of author_wallet on public.posts
for each row execute function internal.protect_post_funding_owner();

create trigger profile_funding_routes_sync_updated_options
after update of asset, chain_namespace, network_reference, recipient_address,
  verification_status on public.profile_funding_routes
for each row execute function internal.sync_saved_route_status();

create trigger profile_funding_routes_revoke_deleted_options
before delete on public.profile_funding_routes
for each row execute function internal.sync_saved_route_status();

insert into public.post_funding_options (
  post_id, profile_wallet, asset, chain_namespace, network_reference,
  recipient_address, verification_status, source, profile_funding_route_id
)
select
  post.id,
  route.profile_wallet,
  route.asset,
  route.chain_namespace,
  route.network_reference,
  route.recipient_address,
  route.verification_status,
  'legacy_seed',
  route.id
from public.posts post
join public.profile_funding_routes route
  on route.profile_wallet = post.author_wallet
 and route.verification_status in ('self_declared', 'verified')
on conflict (post_id, asset) do nothing;

-- Publication accepts a compact [{"asset":"SOL","address":"..."}]
-- payload. The application must first run its strict checksum-aware validator;
-- this helper repeats route/network/shape checks and saves the author's latest
-- reusable route atomically with content publication.
create or replace function internal.upsert_profile_funding_routes(
  p_profile_wallet text,
  p_funding_options jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selection jsonb;
  asset_code text;
  address_value text;
  config public.funding_assets%rowtype;
begin
  p_profile_wallet := btrim(coalesce(p_profile_wallet, ''));
  p_funding_options := coalesce(p_funding_options, '[]'::jsonb);
  if jsonb_typeof(p_funding_options) <> 'array'
     or jsonb_array_length(p_funding_options) > 10 then
    raise exception 'Funding options must be an array with at most ten entries';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_funding_options) item(value)
    where jsonb_typeof(item.value) <> 'object'
       or not (item.value ? 'asset')
       or not (item.value ? 'address')
       or exists (
         select 1 from jsonb_object_keys(item.value) key
         where key not in ('asset', 'address')
       )
  ) then
    raise exception 'Each funding option must contain only asset and address';
  end if;
  if (
    select count(*)
    from jsonb_array_elements(p_funding_options)
  ) <> (
    select count(distinct upper(btrim(item.value ->> 'asset')))
    from jsonb_array_elements(p_funding_options) item(value)
  ) then
    raise exception 'Funding options must contain each asset at most once';
  end if;

  for selection in
    select item.value from jsonb_array_elements(p_funding_options) item(value)
  loop
    asset_code := upper(btrim(coalesce(selection ->> 'asset', '')));
    address_value := btrim(coalesce(selection ->> 'address', ''));
    select asset.* into config
    from public.funding_assets asset
    where asset.asset = asset_code and asset.enabled;
    if not found then raise exception 'Unsupported funding asset: %', asset_code; end if;

    if config.chain_namespace = 'eip155' then
      address_value := lower(address_value);
    elsif config.chain_namespace = 'bip122' and address_value ~* '^bc1' then
      address_value := lower(address_value);
    elsif config.chain_namespace = 'ton'
          and address_value ~* '^(-1|0):[0-9a-f]{64}$' then
      address_value := lower(address_value);
    elsif config.chain_namespace = 'cosmos' then
      address_value := lower(address_value);
    end if;

    if not internal.is_supported_funding_route(
      config.chain_namespace,
      config.network_reference,
      config.asset,
      address_value
    ) then
      raise exception 'Invalid address for funding asset %', asset_code;
    end if;

    insert into public.profile_funding_routes as saved (
      profile_wallet, asset, chain_namespace, network_reference,
      recipient_address, verification_status, verification_method, verified_at
    ) values (
      p_profile_wallet,
      config.asset,
      config.chain_namespace,
      config.network_reference,
      address_value,
      'self_declared',
      'server_syntax_validated',
      null
    )
    on conflict (profile_wallet, asset) do update
    set chain_namespace = excluded.chain_namespace,
        network_reference = excluded.network_reference,
        recipient_address = excluded.recipient_address,
        verification_status = case
          when saved.chain_namespace = excluded.chain_namespace
           and saved.network_reference = excluded.network_reference
           and saved.recipient_address = excluded.recipient_address
           and saved.verification_status = 'verified'
            then 'verified'
          else 'self_declared'
        end,
        verification_method = case
          when saved.chain_namespace = excluded.chain_namespace
           and saved.network_reference = excluded.network_reference
           and saved.recipient_address = excluded.recipient_address
           and saved.verification_status = 'verified'
            then saved.verification_method
          else 'server_syntax_validated'
        end,
        verified_at = case
          when saved.chain_namespace = excluded.chain_namespace
           and saved.network_reference = excluded.network_reference
           and saved.recipient_address = excluded.recipient_address
           and saved.verification_status = 'verified'
            then saved.verified_at
          else null
        end;
  end loop;
end
$$;

drop function public.publish_post_with_media(text, text, text, text, uuid[]);
create or replace function public.publish_post_with_media(
  p_wallet_address text,
  p_nickname text,
  p_body text,
  p_category text,
  p_media_ids uuid[] default array[]::uuid[],
  p_funding_options jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_post_id bigint;
  media_count integer;
  option_count integer;
begin
  p_wallet_address := btrim(coalesce(p_wallet_address, ''));
  p_nickname := btrim(coalesce(p_nickname, ''));
  p_body := btrim(coalesce(p_body, ''));
  p_category := lower(btrim(coalesce(p_category, '')));
  p_media_ids := coalesce(p_media_ids, array[]::uuid[]);
  p_funding_options := coalesce(p_funding_options, '[]'::jsonb);
  media_count := coalesce(array_length(p_media_ids, 1), 0);

  if p_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    raise exception 'Invalid profile address';
  end if;
  if char_length(p_nickname) not between 1 and 50 then
    raise exception 'Invalid nickname';
  end if;
  if char_length(p_body) > 5000 or (p_body = '' and media_count = 0) then
    raise exception 'Invalid post body';
  end if;
  if p_category not in (
    'for-fun', 'memes', 'mutual-aid', 'build', 'animals',
    'art', 'crowdfunding', 'other'
  ) then
    raise exception 'Invalid category';
  end if;
  if media_count > 4 or (
    select count(distinct item.media_id)
    from unnest(p_media_ids) as item(media_id)
  ) <> media_count then
    raise exception 'Invalid media list';
  end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.wallet_address = p_wallet_address
  ) then
    raise exception 'Profile does not exist';
  end if;

  perform internal.upsert_profile_funding_routes(
    p_wallet_address, p_funding_options
  );
  option_count := jsonb_array_length(p_funding_options);

  if media_count > 0 then
    perform 1 from public.media_assets asset
    where asset.id = any(p_media_ids)
    order by asset.id
    for update;
    if (
      select count(*) from public.media_assets asset
      where asset.id = any(p_media_ids)
        and asset.owner_wallet = p_wallet_address
        and asset.status = 'staged'
        and asset.expires_at > now()
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

  -- A nonempty payload is an explicit per-post selection. Empty preserves the
  -- backwards-compatible default installed by posts_seed_funding_options.
  if option_count > 0 then
    delete from public.post_funding_options option
    where option.post_id = new_post_id;
    insert into public.post_funding_options (
      post_id, profile_wallet, asset, chain_namespace, network_reference,
      recipient_address, verification_status, source,
      profile_funding_route_id
    )
    select
      new_post_id,
      route.profile_wallet,
      route.asset,
      route.chain_namespace,
      route.network_reference,
      route.recipient_address,
      route.verification_status,
      'explicit_post',
      route.id
    from jsonb_array_elements(p_funding_options) item(value)
    join public.profile_funding_routes route
      on route.profile_wallet = p_wallet_address
     and route.asset = upper(btrim(item.value ->> 'asset'));
  end if;

  return jsonb_build_object(
    'id', new_post_id,
    'funding_option_count', (
      select count(*) from public.post_funding_options option
      where option.post_id = new_post_id
    )
  );
end
$$;

drop function public.publish_comment_with_media(text, bigint, bigint, text, text, uuid[]);
create or replace function public.publish_comment_with_media(
  p_wallet_address text,
  p_post_id bigint,
  p_parent_id bigint default null,
  p_nickname text default null,
  p_body text default '',
  p_media_ids uuid[] default array[]::uuid[],
  p_funding_options jsonb default '[]'::jsonb
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
  p_funding_options := coalesce(p_funding_options, '[]'::jsonb);
  media_count := coalesce(array_length(p_media_ids, 1), 0);

  if p_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    raise exception 'Invalid profile address';
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
    select 1 from public.profiles profile
    where profile.wallet_address = p_wallet_address
  ) then
    raise exception 'Profile does not exist';
  end if;
  if not exists (select 1 from public.posts post where post.id = p_post_id) then
    raise exception 'Post does not exist';
  end if;
  if p_parent_id is not null and not exists (
    select 1 from public.comments comment
    where comment.id = p_parent_id and comment.post_id = p_post_id
  ) then
    raise exception 'Parent comment does not exist on this post';
  end if;

  perform internal.upsert_profile_funding_routes(
    p_wallet_address, p_funding_options
  );

  if media_count > 0 then
    perform 1 from public.media_assets asset
    where asset.id = any(p_media_ids)
    order by asset.id
    for update;
    if (
      select count(*) from public.media_assets asset
      where asset.id = any(p_media_ids)
        and asset.owner_wallet = p_wallet_address
        and asset.status = 'staged'
        and asset.expires_at > now()
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

  return jsonb_build_object(
    'id', new_comment_id,
    'saved_funding_route_count', jsonb_array_length(p_funding_options)
  );
end
$$;

-- New intents snapshot every verifier-critical value. They are private and
-- single-use. payout/option ids are intentionally not foreign keys: revoking a
-- saved route must disable future issuance without invalidating an already
-- signed, unexpired intent or its permanent donation record.
create table public.funding_intents (
  id uuid primary key default gen_random_uuid(),
  donor_profile_wallet text not null references public.profiles(wallet_address)
    on update cascade on delete restrict,
  recipient_profile_wallet text references public.profiles(wallet_address)
    on update cascade on delete restrict,
  target_type text not null,
  post_id bigint references public.posts(id) on delete cascade,
  comment_id bigint references public.comments(id) on delete cascade,
  post_funding_option_id uuid,
  profile_funding_route_id uuid,
  chain_namespace text not null,
  network_reference text not null,
  asset text not null,
  token_contract text,
  amount_atomic numeric not null,
  sender_address text not null,
  recipient_address text not null,
  destination_verification_status text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  submission_status text not null default 'issued',
  submitted_at timestamptz,
  submitted_transaction_hash text,
  used_at timestamptz,
  used_transaction_hash text,
  used_transfer_index bigint,
  constraint funding_intents_target check (
    (
      target_type = 'post' and post_id is not null and comment_id is null
      and post_funding_option_id is not null
      and profile_funding_route_id is null
    )
    or (
      target_type = 'comment' and comment_id is not null and post_id is null
      and post_funding_option_id is null
      and profile_funding_route_id is not null
    )
    or (
      target_type = 'service' and post_id is null and comment_id is null
      and post_funding_option_id is null
      and profile_funding_route_id is null
      and recipient_profile_wallet is null
    )
  ),
  constraint funding_intents_target_type check (
    target_type in ('post', 'comment', 'service')
  ),
  constraint funding_intents_route check (
    internal.is_supported_funding_route(
      chain_namespace, network_reference, asset, recipient_address
    )
  ),
  constraint funding_intents_amount check (
    amount_atomic = trunc(amount_atomic)
    and amount_atomic >= 1
    and amount_atomic < power(10::numeric, 78)
  ),
  constraint funding_intents_destination_status check (
    destination_verification_status in ('self_declared', 'verified')
  ),
  constraint funding_intents_expiry check (
    expires_at > created_at
    and expires_at <= created_at + case
      when chain_namespace = 'bip122' then interval '2 hours'
      when chain_namespace in ('tron', 'ton', 'cosmos')
        then interval '30 minutes'
      else interval '15 minutes'
    end
  ),
  constraint funding_intents_submission_shape check (
    (
      submission_status = 'issued'
      and submitted_at is null
      and submitted_transaction_hash is null
      and used_at is null
    )
    or (
      submission_status = 'submitted'
      and submitted_at is not null
      and submitted_transaction_hash is not null
      and used_at is null
      and submitted_at >= created_at
      and internal.is_supported_funding_transaction_hash(
        chain_namespace, network_reference, submitted_transaction_hash
      )
    )
    or (
      submission_status = 'verified'
      and submitted_at is not null
      and submitted_transaction_hash is not null
      and used_at is not null
      and submitted_at >= created_at
      and submitted_transaction_hash = used_transaction_hash
      and internal.is_supported_funding_transaction_hash(
        chain_namespace, network_reference, submitted_transaction_hash
      )
    )
  ),
  constraint funding_intents_use_shape check (
    (
      used_at is null
      and used_transaction_hash is null
      and used_transfer_index is null
    )
    or (
      used_at is not null
      and used_transaction_hash is not null
      and used_transfer_index >= 0
      and used_at >= created_at
      and internal.is_supported_funding_transaction_hash(
        chain_namespace, network_reference, used_transaction_hash
      )
    )
  ),
  foreign key (asset, chain_namespace, network_reference)
    references public.funding_assets(asset, chain_namespace, network_reference)
    on update cascade on delete restrict
);

create index funding_intents_donor_rate_idx
  on public.funding_intents (donor_profile_wallet, created_at desc);
create index funding_intents_post_idx
  on public.funding_intents (post_id, created_at desc)
  where post_id is not null;
create index funding_intents_comment_idx
  on public.funding_intents (comment_id, created_at desc)
  where comment_id is not null;
create index funding_intents_expiry_idx
  on public.funding_intents (expires_at)
  where used_at is null;
create unique index funding_intents_used_transfer_idx
  on public.funding_intents (
    chain_namespace, network_reference, used_transaction_hash,
    used_transfer_index
  )
  where used_transaction_hash is not null;
create unique index funding_intents_submitted_transaction_idx
  on public.funding_intents (
    chain_namespace, network_reference, submitted_transaction_hash
  )
  where submitted_transaction_hash is not null;

create table public.funding_donations (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null unique references public.funding_intents(id)
    on update restrict on delete restrict,
  donor_profile_wallet text not null references public.profiles(wallet_address)
    on update cascade on delete restrict,
  recipient_profile_wallet text references public.profiles(wallet_address)
    on update cascade on delete restrict,
  target_type text not null,
  post_id bigint references public.posts(id) on delete cascade,
  comment_id bigint references public.comments(id) on delete cascade,
  post_funding_option_id uuid,
  profile_funding_route_id uuid,
  chain_namespace text not null,
  network_reference text not null,
  asset text not null,
  token_contract text,
  amount_atomic numeric not null,
  transaction_hash text not null,
  transfer_index bigint not null,
  sender_address text not null,
  recipient_address text not null,
  destination_verification_status text not null,
  block_height bigint,
  block_time timestamptz not null,
  status text not null default 'verified',
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint funding_donations_target check (
    (
      target_type = 'post' and post_id is not null and comment_id is null
      and post_funding_option_id is not null
      and profile_funding_route_id is null
    )
    or (
      target_type = 'comment' and comment_id is not null and post_id is null
      and post_funding_option_id is null
      and profile_funding_route_id is not null
    )
    or (
      target_type = 'service' and post_id is null and comment_id is null
      and post_funding_option_id is null
      and profile_funding_route_id is null
      and recipient_profile_wallet is null
    )
  ),
  constraint funding_donations_target_type check (
    target_type in ('post', 'comment', 'service')
  ),
  constraint funding_donations_route check (
    internal.is_supported_funding_route(
      chain_namespace, network_reference, asset, recipient_address
    )
  ),
  constraint funding_donations_amount check (
    amount_atomic = trunc(amount_atomic)
    and amount_atomic >= 1
    and amount_atomic < power(10::numeric, 78)
  ),
  constraint funding_donations_transaction_hash check (
    internal.is_supported_funding_transaction_hash(
      chain_namespace, network_reference, transaction_hash
    )
  ),
  constraint funding_donations_transfer_position check (
    transfer_index >= 0 and (block_height is null or block_height >= 0)
  ),
  constraint funding_donations_destination_status check (
    destination_verification_status in ('self_declared', 'verified')
  ),
  constraint funding_donations_status check (status = 'verified'),
  foreign key (asset, chain_namespace, network_reference)
    references public.funding_assets(asset, chain_namespace, network_reference)
    on update cascade on delete restrict,
  unique (
    chain_namespace, network_reference, asset,
    transaction_hash, transfer_index
  )
);

create index funding_donations_donor_idx
  on public.funding_donations (
    donor_profile_wallet, asset, verified_at desc, id
  );
create index funding_donations_recipient_idx
  on public.funding_donations (
    recipient_profile_wallet, asset, verified_at desc, id
  );
create index funding_donations_post_idx
  on public.funding_donations (post_id, asset, verified_at desc, id)
  where post_id is not null;
create index funding_donations_comment_idx
  on public.funding_donations (comment_id, asset, verified_at desc, id)
  where comment_id is not null;

create or replace function internal.assert_funding_intent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_profile text;
  expected_chain text;
  expected_network text;
  expected_asset text;
  expected_contract text;
  expected_address text;
  expected_status text;
begin
  if new.submission_status <> 'issued'
     or new.submitted_at is not null
     or new.submitted_transaction_hash is not null
     or new.used_at is not null
     or new.used_transaction_hash is not null
     or new.used_transfer_index is not null then
    raise exception 'A new funding intent must begin in issued state';
  end if;
  if new.target_type = 'post' then
    select
      post.author_wallet,
      option.chain_namespace,
      option.network_reference,
      option.asset,
      asset.token_contract,
      option.recipient_address,
      option.verification_status
    into
      expected_profile, expected_chain, expected_network, expected_asset,
      expected_contract, expected_address, expected_status
    from public.posts post
    join public.post_funding_options option
      on option.post_id = post.id
     and option.id = new.post_funding_option_id
    join public.funding_assets asset
      on asset.asset = option.asset and asset.enabled
    where post.id = new.post_id
      and option.verification_status in ('self_declared', 'verified');
  elsif new.target_type = 'comment' then
    select
      comment.author_wallet,
      route.chain_namespace,
      route.network_reference,
      route.asset,
      asset.token_contract,
      route.recipient_address,
      route.verification_status
    into
      expected_profile, expected_chain, expected_network, expected_asset,
      expected_contract, expected_address, expected_status
    from public.comments comment
    join public.profile_funding_routes route
      on route.profile_wallet = comment.author_wallet
     and route.id = new.profile_funding_route_id
    join public.funding_assets asset
      on asset.asset = route.asset and asset.enabled
    where comment.id = new.comment_id
      and route.verification_status in ('self_declared', 'verified');
  else
    select
      null::text,
      asset.chain_namespace,
      asset.network_reference,
      asset.asset,
      asset.token_contract,
      new.recipient_address,
      'verified'::text
    into
      expected_profile, expected_chain, expected_network, expected_asset,
      expected_contract, expected_address, expected_status
    from public.funding_assets asset
    where asset.asset = new.asset
      and asset.chain_namespace = new.chain_namespace
      and asset.network_reference = new.network_reference
      and asset.enabled
      and internal.is_supported_funding_route(
        asset.chain_namespace, asset.network_reference,
        asset.asset, new.recipient_address
      );
  end if;

  if expected_asset is null then
    raise exception 'Funding destination is missing, disabled, or not usable';
  end if;
  if new.recipient_profile_wallet is distinct from expected_profile
     or new.chain_namespace <> expected_chain
     or new.network_reference <> expected_network
     or new.asset <> expected_asset
     or new.token_contract is distinct from expected_contract
     or new.recipient_address <> expected_address
     or new.destination_verification_status <> expected_status then
    raise exception 'Funding intent does not match its server-validated destination';
  end if;
  if new.recipient_profile_wallet is not null
     and new.donor_profile_wallet = new.recipient_profile_wallet then
    raise exception 'A profile cannot fund itself';
  end if;
  if new.sender_address = new.recipient_address then
    raise exception 'Sender and recipient addresses must differ';
  end if;
  if not internal.is_supported_funding_route(
    new.chain_namespace, new.network_reference, new.asset, new.sender_address
  ) then
    raise exception 'Invalid sender address for funding network';
  end if;
  if new.created_at < now() - interval '2 minutes'
     or new.created_at > now() + interval '2 minutes' then
    raise exception 'Invalid funding intent creation time';
  end if;
  return new;
end
$$;

create or replace function internal.protect_funding_intent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.donor_profile_wallet is distinct from old.donor_profile_wallet
     or new.recipient_profile_wallet is distinct from old.recipient_profile_wallet
     or new.target_type is distinct from old.target_type
     or new.post_id is distinct from old.post_id
     or new.comment_id is distinct from old.comment_id
     or new.post_funding_option_id is distinct from old.post_funding_option_id
     or new.profile_funding_route_id is distinct from old.profile_funding_route_id
     or new.chain_namespace is distinct from old.chain_namespace
     or new.network_reference is distinct from old.network_reference
     or new.asset is distinct from old.asset
     or new.token_contract is distinct from old.token_contract
     or new.amount_atomic is distinct from old.amount_atomic
     or new.sender_address is distinct from old.sender_address
     or new.recipient_address is distinct from old.recipient_address
     or new.destination_verification_status is distinct from old.destination_verification_status
     or new.created_at is distinct from old.created_at
     or new.expires_at is distinct from old.expires_at then
    raise exception 'Funding intent terms are immutable';
  end if;

  if old.submission_status = 'issued'
     and new.submission_status = 'submitted'
     and old.submitted_at is null
     and old.submitted_transaction_hash is null
     and new.submitted_at is not null
     and new.submitted_transaction_hash is not null
     and new.used_at is null
     and new.used_transaction_hash is null
     and new.used_transfer_index is null then
    return new;
  end if;

  if old.submission_status in ('issued', 'submitted')
     and new.submission_status = 'verified'
     and old.used_at is null
     and old.used_transaction_hash is null
     and old.used_transfer_index is null
     and new.submitted_at is not null
     and new.submitted_transaction_hash is not null
     and new.used_at is not null
     and new.used_transaction_hash is not null
     and new.used_transfer_index is not null
     and (
       old.submission_status = 'issued'
       or (
         new.submitted_at is not distinct from old.submitted_at
         and new.submitted_transaction_hash
           is not distinct from old.submitted_transaction_hash
       )
     ) then
    return new;
  end if;
  raise exception 'Invalid funding intent state transition';
end
$$;

create or replace function internal.assert_funding_donation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent public.funding_intents%rowtype;
begin
  select candidate.* into intent
  from public.funding_intents candidate
  where candidate.id = new.intent_id
  for update;
  if not found then raise exception 'Funding intent does not exist'; end if;
  if intent.used_at is not null then
    raise exception 'Funding intent was already used';
  end if;
  if new.donor_profile_wallet is distinct from intent.donor_profile_wallet
     or new.recipient_profile_wallet is distinct from intent.recipient_profile_wallet
     or new.target_type <> intent.target_type
     or new.post_id is distinct from intent.post_id
     or new.comment_id is distinct from intent.comment_id
     or new.post_funding_option_id is distinct from intent.post_funding_option_id
     or new.profile_funding_route_id is distinct from intent.profile_funding_route_id
     or new.chain_namespace <> intent.chain_namespace
     or new.network_reference <> intent.network_reference
     or new.asset <> intent.asset
     or new.token_contract is distinct from intent.token_contract
     or new.amount_atomic <> intent.amount_atomic
     or new.sender_address <> intent.sender_address
     or new.recipient_address <> intent.recipient_address
     or new.destination_verification_status <> intent.destination_verification_status then
    raise exception 'Verified transfer does not match funding intent';
  end if;
  if new.block_time < intent.created_at - interval '2 minutes'
     or new.block_time > intent.expires_at + interval '2 minutes'
     or new.block_time > now() + interval '2 minutes' then
    raise exception 'Transaction timestamp does not match funding intent';
  end if;
  return new;
end
$$;

create or replace function internal.reject_funding_donation_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Verified funding donation records are immutable';
end
$$;

create or replace function internal.assert_recorded_funding_intent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.funding_intents intent
    where intent.id = new.intent_id
      and intent.used_at is not null
      and intent.used_transaction_hash = new.transaction_hash
      and intent.used_transfer_index = new.transfer_index
  ) then
    raise exception 'Verified funding donation requires a matching used intent';
  end if;
  return new;
end
$$;

create trigger funding_intents_validate
before insert on public.funding_intents
for each row execute function internal.assert_funding_intent();

create trigger funding_intents_protect
before update on public.funding_intents
for each row execute function internal.protect_funding_intent();

create trigger funding_donations_validate
before insert on public.funding_donations
for each row execute function internal.assert_funding_donation();

create trigger funding_donations_immutable
before update or delete on public.funding_donations
for each row execute function internal.reject_funding_donation_change();

create constraint trigger funding_donations_require_used_intent
after insert on public.funding_donations
deferrable initially deferred
for each row execute function internal.assert_recorded_funding_intent();

create or replace function public.issue_funding_intent(
  p_donor_profile_wallet text,
  p_sender_address text,
  p_target_type text,
  p_amount_atomic numeric,
  p_post_id bigint default null,
  p_comment_id bigint default null,
  p_post_funding_option_id uuid default null,
  p_profile_funding_route_id uuid default null,
  p_service_asset text default null,
  p_service_recipient_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  destination_profile text;
  destination_chain text;
  destination_network text;
  destination_asset text;
  destination_contract text;
  destination_address text;
  destination_status text;
  intent_id uuid;
  intent_expiry timestamptz;
  recent_count bigint;
begin
  p_donor_profile_wallet := btrim(coalesce(p_donor_profile_wallet, ''));
  p_sender_address := btrim(coalesce(p_sender_address, ''));
  p_target_type := lower(btrim(coalesce(p_target_type, '')));
  p_service_asset := nullif(upper(btrim(coalesce(p_service_asset, ''))), '');
  p_service_recipient_address := nullif(
    btrim(coalesce(p_service_recipient_address, '')),
    ''
  );

  if not exists (
    select 1 from public.profiles profile
    where profile.wallet_address = p_donor_profile_wallet
  ) then
    raise exception 'Donor profile does not exist';
  end if;
  if p_amount_atomic is null
     or p_amount_atomic <> trunc(p_amount_atomic)
     or p_amount_atomic < 1
     or p_amount_atomic >= power(10::numeric, 78) then
    raise exception 'Invalid atomic funding amount';
  end if;

  if p_target_type = 'post'
     and p_post_id is not null
     and p_comment_id is null
     and p_post_funding_option_id is not null
     and p_profile_funding_route_id is null
     and p_service_asset is null
     and p_service_recipient_address is null then
    select
      post.author_wallet,
      option.chain_namespace,
      option.network_reference,
      option.asset,
      asset.token_contract,
      option.recipient_address,
      option.verification_status
    into
      destination_profile, destination_chain, destination_network,
      destination_asset, destination_contract, destination_address,
      destination_status
    from public.posts post
    join public.post_funding_options option
      on option.post_id = post.id
     and option.id = p_post_funding_option_id
    join public.funding_assets asset
      on asset.asset = option.asset and asset.enabled
    where post.id = p_post_id
      and option.verification_status in ('self_declared', 'verified')
    for share of post, option;
  elsif p_target_type = 'comment'
     and p_comment_id is not null
     and p_post_id is null
     and p_post_funding_option_id is null
     and p_profile_funding_route_id is not null
     and p_service_asset is null
     and p_service_recipient_address is null then
    select
      comment.author_wallet,
      route.chain_namespace,
      route.network_reference,
      route.asset,
      asset.token_contract,
      route.recipient_address,
      route.verification_status
    into
      destination_profile, destination_chain, destination_network,
      destination_asset, destination_contract, destination_address,
      destination_status
    from public.comments comment
    join public.profile_funding_routes route
      on route.profile_wallet = comment.author_wallet
     and route.id = p_profile_funding_route_id
    join public.funding_assets asset
      on asset.asset = route.asset and asset.enabled
    where comment.id = p_comment_id
      and route.verification_status in ('self_declared', 'verified')
    for share of comment, route;
  elsif p_target_type = 'service'
     and p_post_id is null
     and p_comment_id is null
     and p_post_funding_option_id is null
     and p_profile_funding_route_id is null
     and p_service_asset is not null
     and p_service_recipient_address is not null then
    select
      null::text,
      asset.chain_namespace,
      asset.network_reference,
      asset.asset,
      asset.token_contract,
      p_service_recipient_address,
      'verified'::text
    into
      destination_profile, destination_chain, destination_network,
      destination_asset, destination_contract, destination_address,
      destination_status
    from public.funding_assets asset
    where asset.asset = p_service_asset
      and asset.enabled;
  else
    raise exception 'Invalid funding target';
  end if;

  if destination_asset is null then
    raise exception 'Funding destination is unavailable';
  end if;

  if destination_chain = 'eip155' then
    p_sender_address := lower(p_sender_address);
    destination_address := lower(destination_address);
  elsif destination_chain = 'bip122' then
    if p_sender_address ~* '^bc1' then
      p_sender_address := lower(p_sender_address);
    end if;
    if destination_address ~* '^bc1' then
      destination_address := lower(destination_address);
    end if;
  elsif destination_chain = 'ton' then
    if p_sender_address ~* '^(-1|0):[0-9a-f]{64}$' then
      p_sender_address := lower(p_sender_address);
    end if;
    if destination_address ~* '^(-1|0):[0-9a-f]{64}$' then
      destination_address := lower(destination_address);
    end if;
  elsif destination_chain = 'cosmos' then
    p_sender_address := lower(p_sender_address);
    destination_address := lower(destination_address);
  end if;

  if not internal.is_supported_funding_route(
    destination_chain, destination_network,
    destination_asset, destination_address
  ) then
    raise exception 'Invalid recipient address for funding network';
  end if;
  if destination_profile is not null
     and p_donor_profile_wallet = destination_profile then
    raise exception 'A profile cannot fund itself';
  end if;
  if p_sender_address = destination_address then
    raise exception 'Sender and recipient addresses must differ';
  end if;
  if not internal.is_supported_funding_route(
    destination_chain, destination_network, destination_asset, p_sender_address
  ) then
    raise exception 'Invalid sender address for funding network';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'money-nerds-multichain-funding:' || p_donor_profile_wallet,
      0
    )
  );
  select count(*) into recent_count
  from public.funding_intents intent
  where intent.donor_profile_wallet = p_donor_profile_wallet
    and intent.created_at >= now() - interval '1 minute';
  if recent_count >= 12 then
    raise exception 'Funding intent rate limit exceeded';
  end if;

  intent_expiry := now() + case
    when destination_chain = 'bip122' then interval '2 hours'
    when destination_chain in ('tron', 'ton', 'cosmos')
      then interval '30 minutes'
    else interval '15 minutes'
  end;
  insert into public.funding_intents (
    donor_profile_wallet, recipient_profile_wallet, target_type,
    post_id, comment_id, post_funding_option_id, profile_funding_route_id,
    chain_namespace, network_reference, asset, token_contract,
    amount_atomic, sender_address, recipient_address,
    destination_verification_status, expires_at
  ) values (
    p_donor_profile_wallet, destination_profile, p_target_type,
    p_post_id, p_comment_id, p_post_funding_option_id,
    p_profile_funding_route_id, destination_chain, destination_network,
    destination_asset, destination_contract, p_amount_atomic,
    p_sender_address, destination_address, destination_status, intent_expiry
  )
  returning id into intent_id;

  return jsonb_build_object(
    'id', intent_id,
    'recipient_profile_wallet', destination_profile,
    'chain_namespace', destination_chain,
    'network_reference', destination_network,
    'asset', destination_asset,
    'token_contract', destination_contract,
    'amount_atomic', p_amount_atomic::text,
    'sender_address', p_sender_address,
    'recipient_address', destination_address,
    'destination_verification_status', destination_status,
    'expires_at', intent_expiry
  );
end
$$;

-- PostgREST numeric values may exceed JavaScript's exact integer range. This
-- donor-bound private read contract serializes amount_atomic as decimal text.
create or replace function public.get_funding_intent_for_verification(
  p_intent_id uuid,
  p_donor_profile_wallet text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  p_donor_profile_wallet := btrim(coalesce(p_donor_profile_wallet, ''));
  select jsonb_build_object(
    'id', intent.id,
    'donor_profile_wallet', intent.donor_profile_wallet,
    'recipient_profile_wallet', intent.recipient_profile_wallet,
    'target_type', intent.target_type,
    'post_id', intent.post_id,
    'comment_id', intent.comment_id,
    'post_funding_option_id', intent.post_funding_option_id,
    'profile_funding_route_id', intent.profile_funding_route_id,
    'chain_namespace', intent.chain_namespace,
    'network_reference', intent.network_reference,
    'asset', intent.asset,
    'token_contract', intent.token_contract,
    'amount_atomic', intent.amount_atomic::text,
    'sender_address', intent.sender_address,
    'recipient_address', intent.recipient_address,
    'destination_verification_status', intent.destination_verification_status,
    'created_at', intent.created_at,
    'expires_at', intent.expires_at,
    'submission_status', intent.submission_status,
    'submitted_at', intent.submitted_at,
    'submitted_transaction_hash', intent.submitted_transaction_hash,
    'used_at', intent.used_at,
    'used_transaction_hash', intent.used_transaction_hash,
    'used_transfer_index', intent.used_transfer_index
  ) into result
  from public.funding_intents intent
  where intent.id = p_intent_id
    and intent.donor_profile_wallet = p_donor_profile_wallet;
  return result;
end
$$;

-- Manual wallet flows submit a transaction hash for asynchronous verification.
-- This transition is private, donor-bound, single-hash, and does not create a
-- public donation or affect totals until a chain verifier calls the record RPC.
create or replace function public.submit_funding_transaction(
  p_intent_id uuid,
  p_donor_profile_wallet text,
  p_transaction_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent public.funding_intents%rowtype;
begin
  p_donor_profile_wallet := btrim(coalesce(p_donor_profile_wallet, ''));
  p_transaction_hash := btrim(coalesce(p_transaction_hash, ''));
  if p_intent_id is null then raise exception 'Funding intent is required'; end if;

  select candidate.* into intent
  from public.funding_intents candidate
  where candidate.id = p_intent_id
  for update;
  if not found then raise exception 'Funding intent does not exist'; end if;
  if intent.donor_profile_wallet <> p_donor_profile_wallet then
    raise exception 'Funding intent does not belong to donor profile';
  end if;

  if intent.chain_namespace in ('eip155', 'bip122', 'tron', 'cosmos')
     or (
       intent.chain_namespace = 'ton'
       and p_transaction_hash ~* '^[0-9a-f]{64}$'
     ) then
    p_transaction_hash := lower(p_transaction_hash);
  end if;
  if not internal.is_supported_funding_transaction_hash(
    intent.chain_namespace, intent.network_reference, p_transaction_hash
  ) then
    raise exception 'Invalid transaction hash for funding network';
  end if;

  if intent.used_at is not null then
    if intent.used_transaction_hash = p_transaction_hash then
      return jsonb_build_object(
        'accepted', true,
        'status', 'verified',
        'intent_id', intent.id,
        'transaction_hash', p_transaction_hash,
        'already_submitted', true
      );
    end if;
    raise exception 'Funding intent was already used';
  end if;
  if now() > intent.expires_at then
    raise exception 'Funding intent has expired';
  end if;
  if intent.submission_status = 'submitted' then
    if intent.submitted_transaction_hash = p_transaction_hash then
      return jsonb_build_object(
        'accepted', true,
        'status', 'pending',
        'intent_id', intent.id,
        'transaction_hash', p_transaction_hash,
        'already_submitted', true
      );
    end if;
    raise exception 'Funding intent already has a different transaction hash';
  end if;
  if intent.submission_status <> 'issued' then
    raise exception 'Funding intent is not open for submission';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'money-nerds-funding-transaction:'
        || intent.chain_namespace || ':' || intent.network_reference || ':'
        || p_transaction_hash,
      0
    )
  );
  if exists (
    select 1
    from public.funding_intents other
    where other.chain_namespace = intent.chain_namespace
      and other.network_reference = intent.network_reference
      and other.submitted_transaction_hash = p_transaction_hash
      and other.id <> intent.id
  ) then
    raise exception 'Transaction hash is already bound to another funding intent';
  end if;

  update public.funding_intents
  set submission_status = 'submitted',
      submitted_at = now(),
      submitted_transaction_hash = p_transaction_hash
  where id = intent.id
    and submission_status = 'issued'
    and used_at is null;
  if not found then raise exception 'Funding intent is not open for submission'; end if;

  return jsonb_build_object(
    'accepted', true,
    'status', 'pending',
    'intent_id', intent.id,
    'transaction_hash', p_transaction_hash,
    'already_submitted', false
  );
end
$$;

create or replace function public.record_verified_funding_donation(
  p_intent_id uuid,
  p_chain_namespace text,
  p_network_reference text,
  p_asset text,
  p_amount_atomic numeric,
  p_transaction_hash text,
  p_transfer_index bigint,
  p_sender_address text,
  p_recipient_address text,
  p_block_height bigint,
  p_block_time timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent public.funding_intents%rowtype;
  existing public.funding_donations%rowtype;
  donation_id uuid;
begin
  p_chain_namespace := lower(btrim(coalesce(p_chain_namespace, '')));
  p_network_reference := btrim(coalesce(p_network_reference, ''));
  p_asset := upper(btrim(coalesce(p_asset, '')));
  p_transaction_hash := btrim(coalesce(p_transaction_hash, ''));
  p_sender_address := btrim(coalesce(p_sender_address, ''));
  p_recipient_address := btrim(coalesce(p_recipient_address, ''));

  if p_chain_namespace in ('eip155', 'bip122', 'tron', 'cosmos')
     or (
       p_chain_namespace = 'ton'
       and p_transaction_hash ~* '^[0-9a-f]{64}$'
     ) then
    p_transaction_hash := lower(p_transaction_hash);
  end if;
  if p_chain_namespace = 'eip155' then
    p_sender_address := lower(p_sender_address);
    p_recipient_address := lower(p_recipient_address);
  elsif p_chain_namespace = 'bip122' then
    if p_sender_address ~* '^bc1' then
      p_sender_address := lower(p_sender_address);
    end if;
    if p_recipient_address ~* '^bc1' then
      p_recipient_address := lower(p_recipient_address);
    end if;
  elsif p_chain_namespace = 'ton' then
    if p_sender_address ~* '^(-1|0):[0-9a-f]{64}$' then
      p_sender_address := lower(p_sender_address);
    end if;
    if p_recipient_address ~* '^(-1|0):[0-9a-f]{64}$' then
      p_recipient_address := lower(p_recipient_address);
    end if;
  elsif p_chain_namespace = 'cosmos' then
    p_sender_address := lower(p_sender_address);
    p_recipient_address := lower(p_recipient_address);
  end if;

  if p_intent_id is null then raise exception 'Funding intent is required'; end if;
  if p_transfer_index is null or p_transfer_index < 0 then
    raise exception 'Invalid transfer index';
  end if;
  if p_block_height is not null and p_block_height < 0 then
    raise exception 'Invalid block height';
  end if;
  if p_block_time is null then raise exception 'Block time is required'; end if;
  if not internal.is_supported_funding_transaction_hash(
    p_chain_namespace, p_network_reference, p_transaction_hash
  ) then
    raise exception 'Invalid transaction hash for funding network';
  end if;

  select candidate.* into intent
  from public.funding_intents candidate
  where candidate.id = p_intent_id
  for update;
  if not found then raise exception 'Funding intent does not exist'; end if;

  if intent.used_at is not null then
    select donation.* into existing
    from public.funding_donations donation
    where donation.intent_id = intent.id;
    if found
       and existing.chain_namespace = p_chain_namespace
       and existing.network_reference = p_network_reference
       and existing.asset = p_asset
       and existing.amount_atomic = p_amount_atomic
       and existing.transaction_hash = p_transaction_hash
       and existing.transfer_index = p_transfer_index
       and existing.sender_address = p_sender_address
       and existing.recipient_address = p_recipient_address
       and existing.block_height is not distinct from p_block_height
       and existing.block_time = p_block_time then
      return jsonb_build_object(
        'verified', true,
        'id', existing.id,
        'transaction_hash', existing.transaction_hash,
        'already_recorded', true
      );
    end if;
    raise exception 'Funding intent was already used';
  end if;

  if p_chain_namespace <> intent.chain_namespace
     or p_network_reference <> intent.network_reference
     or p_asset <> intent.asset
     or p_amount_atomic is distinct from intent.amount_atomic
     or p_sender_address <> intent.sender_address
     or p_recipient_address <> intent.recipient_address then
    raise exception 'Verified transaction does not match funding intent';
  end if;
  if intent.submitted_transaction_hash is not null
     and intent.submitted_transaction_hash <> p_transaction_hash then
    raise exception 'Verified transaction hash does not match submitted funding transaction';
  end if;

  insert into public.funding_donations (
    intent_id, donor_profile_wallet, recipient_profile_wallet, target_type,
    post_id, comment_id, post_funding_option_id, profile_funding_route_id,
    chain_namespace, network_reference, asset, token_contract,
    amount_atomic, transaction_hash, transfer_index, sender_address,
    recipient_address, destination_verification_status,
    block_height, block_time, status, verified_at
  ) values (
    intent.id, intent.donor_profile_wallet, intent.recipient_profile_wallet,
    intent.target_type, intent.post_id, intent.comment_id,
    intent.post_funding_option_id, intent.profile_funding_route_id,
    intent.chain_namespace, intent.network_reference, intent.asset,
    intent.token_contract, intent.amount_atomic, p_transaction_hash,
    p_transfer_index, intent.sender_address, intent.recipient_address,
    intent.destination_verification_status, p_block_height, p_block_time,
    'verified', now()
  )
  returning id into donation_id;

  update public.funding_intents
  set submission_status = 'verified',
      submitted_at = coalesce(submitted_at, now()),
      submitted_transaction_hash = coalesce(
        submitted_transaction_hash,
        p_transaction_hash
      ),
      used_at = now(),
      used_transaction_hash = p_transaction_hash,
      used_transfer_index = p_transfer_index
  where id = intent.id and used_at is null;
  if not found then raise exception 'Funding intent was already used'; end if;

  return jsonb_build_object(
    'verified', true,
    'id', donation_id,
    'transaction_hash', p_transaction_hash,
    'already_recorded', false
  );
end
$$;

-- Atomic one-time binding helper. Existing profiles retain their public key,
-- identity provider, posts, comments, likes, and donation attribution.
create or replace function internal.bind_clerk_existing_profile(
  p_clerk_user_id text,
  p_profile_wallet text,
  p_binding_kind text,
  p_clerk_updated_at timestamptz,
  p_display_name text default null,
  p_avatar_url text default null,
  p_clerk_created_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  p_clerk_user_id := btrim(coalesce(p_clerk_user_id, ''));
  p_profile_wallet := btrim(coalesce(p_profile_wallet, ''));
  p_binding_kind := lower(btrim(coalesce(p_binding_kind, '')));
  p_display_name := nullif(btrim(coalesce(p_display_name, '')), '');
  p_avatar_url := nullif(btrim(coalesce(p_avatar_url, '')), '');

  if p_clerk_user_id !~ '^user_[A-Za-z0-9_-]{3,190}$' then
    raise exception 'Invalid Clerk user id';
  end if;
  if p_binding_kind not in (
    'legacy_session', 'verified_wallet', 'verified_external'
  ) then
    raise exception 'Invalid Clerk existing-profile binding kind';
  end if;
  if p_clerk_updated_at is null
     or p_clerk_updated_at > now() + interval '1 day'
     or (
       p_clerk_created_at is not null
       and p_clerk_created_at > p_clerk_updated_at
     ) then
    raise exception 'Invalid Clerk event timestamps';
  end if;
  if p_display_name is not null
     and char_length(p_display_name) not between 1 and 80 then
    raise exception 'Invalid public display name';
  end if;
  if p_avatar_url is not null and (
    char_length(p_avatar_url) not between 8 and 2048
    or p_avatar_url !~* '^https://'
  ) then
    raise exception 'Invalid public avatar URL';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('money-nerds-clerk:' || p_clerk_user_id, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('money-nerds-clerk-profile:' || p_profile_wallet, 0)
  );
  perform 1 from public.profiles profile
  where profile.wallet_address = p_profile_wallet
  for update;
  if not found then raise exception 'Existing profile does not exist'; end if;
  if exists (
    select 1
    from internal.clerk_profile_links link
    where link.clerk_user_id = p_clerk_user_id
       or link.profile_wallet = p_profile_wallet
  ) then
    raise exception 'Clerk identity or profile is already linked';
  end if;

  insert into internal.clerk_profile_links (
    clerk_user_id, profile_wallet, binding_kind, clerk_created_at,
    clerk_updated_at, last_synced_at
  ) values (
    p_clerk_user_id, p_profile_wallet, p_binding_kind, p_clerk_created_at,
    p_clerk_updated_at, now()
  );
  return jsonb_build_object(
    'profile_wallet', p_profile_wallet,
    'binding_kind', p_binding_kind,
    'deleted', false
  );
end
$$;

-- First-sync precedence #1: bind Clerk to the exact canonical profile owned by
-- an active, unrevoked mn_session. Only a SHA-256 token hash crosses into SQL.
create or replace function public.bind_clerk_profile_from_legacy_session(
  p_clerk_user_id text,
  p_legacy_token_hash text,
  p_clerk_updated_at timestamptz,
  p_display_name text default null,
  p_avatar_url text default null,
  p_clerk_created_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_profile text;
begin
  p_legacy_token_hash := lower(btrim(coalesce(p_legacy_token_hash, '')));
  if p_legacy_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid legacy session token hash';
  end if;
  select session.wallet_address into session_profile
  from public.wallet_sessions session
  where session.token_hash = p_legacy_token_hash
    and session.revoked_at is null
    and session.expires_at > now()
  for update;
  if not found then raise exception 'Legacy session is invalid or expired'; end if;

  return internal.bind_clerk_existing_profile(
    p_clerk_user_id,
    session_profile,
    'legacy_session',
    p_clerk_updated_at,
    p_display_name,
    p_avatar_url,
    p_clerk_created_at
  );
end
$$;

-- First-sync precedence #2: the server may bind a Clerk wallet only after it
-- independently verifies Clerk's Solana wallet ownership. SQL requires that the
-- destination is an existing canonical wallet profile, never a proxy identity.
create or replace function public.bind_clerk_profile_from_verified_wallet(
  p_clerk_user_id text,
  p_profile_wallet text,
  p_clerk_updated_at timestamptz,
  p_display_name text default null,
  p_avatar_url text default null,
  p_clerk_created_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  p_profile_wallet := btrim(coalesce(p_profile_wallet, ''));
  if not exists (
    select 1
    from public.profiles profile
    where profile.wallet_address = p_profile_wallet
      and profile.identity_kind = 'wallet'
      and profile.identity_provider is null
  ) then
    raise exception 'Verified Clerk wallet does not match a canonical wallet profile';
  end if;
  return internal.bind_clerk_existing_profile(
    p_clerk_user_id,
    p_profile_wallet,
    'verified_wallet',
    p_clerk_updated_at,
    p_display_name,
    p_avatar_url,
    p_clerk_created_at
  );
end
$$;

-- First-sync precedence #3: reuse a previously verified social-provider proxy.
-- The server passes only the stable keyed subject digest, never the raw subject.
create or replace function public.bind_clerk_profile_from_verified_external(
  p_clerk_user_id text,
  p_provider text,
  p_subject_hash text,
  p_clerk_updated_at timestamptz,
  p_display_name text default null,
  p_avatar_url text default null,
  p_clerk_created_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  external_profile text;
begin
  p_provider := lower(btrim(coalesce(p_provider, '')));
  p_subject_hash := lower(btrim(coalesce(p_subject_hash, '')));
  if p_provider not in ('google', 'apple', 'telegram')
     or p_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid verified external identity';
  end if;

  select link.proxy_wallet_address into external_profile
  from internal.external_identity_links link
  join public.profiles profile
    on profile.wallet_address = link.proxy_wallet_address
   and profile.identity_kind = 'external'
   and profile.identity_provider = p_provider
  where link.provider = p_provider
    and link.subject_hash = p_subject_hash
  for update of link, profile;
  if not found then
    raise exception 'Verified external identity does not match an existing profile';
  end if;

  return internal.bind_clerk_existing_profile(
    p_clerk_user_id,
    external_profile,
    'verified_external',
    p_clerk_updated_at,
    p_display_name,
    p_avatar_url,
    p_clerk_created_at
  );
end
$$;

-- Clerk webhooks call this service-only RPC. Out-of-order events cannot roll a
-- profile backward. A derived proxy is created only when no existing-profile
-- binding won precedence. Deleting Clerk never destroys a bound legacy wallet.
create or replace function public.sync_clerk_profile(
  p_clerk_user_id text,
  p_proxy_wallet_address text,
  p_clerk_updated_at timestamptz,
  p_display_name text default null,
  p_avatar_url text default null,
  p_clerk_created_at timestamptz default null,
  p_deleted boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing internal.clerk_profile_links%rowtype;
  effective_profile text;
  effective_binding text;
  profile_kind text;
  profile_provider text;
begin
  p_clerk_user_id := btrim(coalesce(p_clerk_user_id, ''));
  p_proxy_wallet_address := btrim(coalesce(p_proxy_wallet_address, ''));
  p_display_name := nullif(btrim(coalesce(p_display_name, '')), '');
  p_avatar_url := nullif(btrim(coalesce(p_avatar_url, '')), '');
  p_deleted := coalesce(p_deleted, false);

  if p_clerk_user_id !~ '^user_[A-Za-z0-9_-]{3,190}$' then
    raise exception 'Invalid Clerk user id';
  end if;
  if p_proxy_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
     or p_proxy_wallet_address = '11111111111111111111111111111111' then
    raise exception 'Invalid Clerk profile key';
  end if;
  if p_clerk_updated_at is null
     or p_clerk_updated_at > now() + interval '1 day'
     or (
       p_clerk_created_at is not null
       and p_clerk_created_at > p_clerk_updated_at
     ) then
    raise exception 'Invalid Clerk event timestamps';
  end if;
  if p_display_name is not null
     and char_length(p_display_name) not between 1 and 80 then
    raise exception 'Invalid public display name';
  end if;
  if p_avatar_url is not null and (
    char_length(p_avatar_url) not between 8 and 2048
    or p_avatar_url !~* '^https://'
  ) then
    raise exception 'Invalid public avatar URL';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('money-nerds-clerk:' || p_clerk_user_id, 0)
  );
  select link.* into existing
  from internal.clerk_profile_links link
  where link.clerk_user_id = p_clerk_user_id
  for update;

  if found then
    effective_profile := existing.profile_wallet;
    effective_binding := existing.binding_kind;
    if effective_binding = 'clerk_proxy'
       and effective_profile <> p_proxy_wallet_address then
      raise exception 'Clerk identity derivation does not match its existing profile';
    end if;
    if p_clerk_updated_at < existing.clerk_updated_at then
      return jsonb_build_object(
        'profile_wallet', effective_profile,
        'binding_kind', effective_binding,
        'deleted', existing.deleted_at is not null,
        'stale_event_ignored', true
      );
    end if;
  else
    effective_profile := p_proxy_wallet_address;
    effective_binding := 'clerk_proxy';
    insert into public.profiles (
      wallet_address, display_name, avatar_url, identity_kind, identity_provider
    ) values (
      effective_profile,
      case when p_deleted then 'Deleted user' else p_display_name end,
      case when p_deleted then null else p_avatar_url end,
      'external',
      'clerk'
    )
    on conflict (wallet_address) do nothing;

    select profile.identity_kind, profile.identity_provider
    into profile_kind, profile_provider
    from public.profiles profile
    where profile.wallet_address = effective_profile;
    if profile_kind <> 'external' or profile_provider <> 'clerk' then
      raise exception 'Clerk profile key collision';
    end if;
  end if;

  insert into internal.clerk_profile_links as link (
    clerk_user_id, profile_wallet, binding_kind, clerk_created_at,
    clerk_updated_at, last_synced_at, deleted_at
  ) values (
    p_clerk_user_id,
    effective_profile,
    effective_binding,
    p_clerk_created_at,
    p_clerk_updated_at,
    now(),
    case when p_deleted then p_clerk_updated_at else null end
  )
  on conflict (clerk_user_id) do update
  set clerk_created_at = coalesce(link.clerk_created_at, excluded.clerk_created_at),
      clerk_updated_at = excluded.clerk_updated_at,
      last_synced_at = now(),
      deleted_at = excluded.deleted_at;

  if p_deleted and effective_binding = 'clerk_proxy' then
    update public.profiles
    set display_name = 'Deleted user', bio = null, avatar_url = null
    where wallet_address = effective_profile;
    update public.profile_funding_routes
    set verification_status = 'revoked'
    where profile_wallet = effective_profile
      and verification_status <> 'revoked';
    update public.post_funding_options
    set verification_status = 'revoked'
    where profile_wallet = effective_profile
      and verification_status <> 'revoked';
  elsif not p_deleted and effective_binding = 'clerk_proxy' then
    update public.profiles profile
    set display_name = coalesce(p_display_name, profile.display_name),
        avatar_url = coalesce(p_avatar_url, profile.avatar_url)
    where profile.wallet_address = effective_profile;
  end if;

  return jsonb_build_object(
    'profile_wallet', effective_profile,
    'binding_kind', effective_binding,
    'deleted', p_deleted,
    'stale_event_ignored', false
  );
end
$$;

create or replace function public.get_clerk_profile(p_clerk_user_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  p_clerk_user_id := btrim(coalesce(p_clerk_user_id, ''));
  if p_clerk_user_id !~ '^user_[A-Za-z0-9_-]{3,190}$' then
    return null;
  end if;
  select jsonb_build_object(
    'profile_wallet', link.profile_wallet,
    'binding_kind', link.binding_kind,
    'display_name', profile.display_name,
    'avatar_url', profile.avatar_url,
    'deleted', link.deleted_at is not null,
    'clerk_updated_at', link.clerk_updated_at
  )
  into result
  from internal.clerk_profile_links link
  join public.profiles profile
    on profile.wallet_address = link.profile_wallet
  where link.clerk_user_id = p_clerk_user_id;
  return result;
end
$$;

-- Public activity preserves the existing verified Solana ledger without copying
-- or rewriting it, then unions new multichain records under one attribution
-- contract. Legacy devnet/testnet labels remain explicit instead of pretending
-- to be mainnet CAIP references.
create or replace view public.verified_funding_activity
with (security_invoker = true)
as
select
  'multichain:' || donation.id::text as record_id,
  'multichain'::text as source,
  donation.donor_profile_wallet,
  donation.recipient_profile_wallet,
  donation.target_type,
  donation.post_id,
  donation.comment_id,
  donation.chain_namespace,
  donation.network_reference,
  donation.asset,
  donation.amount_atomic,
  donation.transaction_hash,
  donation.transfer_index,
  donation.sender_address,
  donation.recipient_address,
  donation.block_height,
  donation.block_time,
  donation.verified_at,
  donation.destination_verification_status
from public.funding_donations donation
union all
select
  'legacy-sol:' || donation.signature || ':' || donation.instruction_index::text,
  'legacy_sol'::text,
  donation.donor_wallet,
  recipient.wallet_address,
  donation.target_type,
  donation.post_id,
  donation.comment_id,
  'solana'::text,
  case donation.network
    when 'mainnet-beta' then '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
    else donation.network
  end,
  'SOL'::text,
  donation.lamports::numeric,
  donation.signature,
  donation.instruction_index::bigint,
  donation.donor_wallet,
  donation.recipient_wallet,
  donation.slot,
  donation.created_at,
  donation.verified_at,
  'legacy_verified'::text
from public.donations donation
left join public.profiles recipient
  on recipient.wallet_address = donation.recipient_wallet;

create or replace view public.post_funding_totals
with (security_invoker = true)
as
select
  activity.post_id,
  activity.chain_namespace,
  activity.network_reference,
  activity.asset,
  sum(activity.amount_atomic)::numeric as received_atomic,
  count(*)::bigint as donation_count,
  min(activity.verified_at) as first_verified_at,
  max(activity.verified_at) as last_verified_at
from public.verified_funding_activity activity
where activity.post_id is not null
group by
  activity.post_id, activity.chain_namespace,
  activity.network_reference, activity.asset;

create or replace view public.target_funding_totals
with (security_invoker = true)
as
select
  activity.target_type,
  activity.post_id,
  activity.comment_id,
  activity.chain_namespace,
  activity.network_reference,
  activity.asset,
  sum(activity.amount_atomic)::numeric as received_atomic,
  count(*)::bigint as donation_count,
  min(activity.verified_at) as first_verified_at,
  max(activity.verified_at) as last_verified_at
from public.verified_funding_activity activity
group by
  activity.target_type, activity.post_id, activity.comment_id,
  activity.chain_namespace, activity.network_reference, activity.asset;

create or replace view public.profile_funding_totals
with (security_invoker = true)
as
with profile_events as (
  select
    activity.donor_profile_wallet as profile_wallet,
    activity.chain_namespace,
    activity.network_reference,
    activity.asset,
    activity.amount_atomic as sent_atomic,
    0::numeric as received_atomic,
    1::bigint as sent_count,
    0::bigint as received_count
  from public.verified_funding_activity activity
  where activity.donor_profile_wallet is not null
  union all
  select
    activity.recipient_profile_wallet,
    activity.chain_namespace,
    activity.network_reference,
    activity.asset,
    0::numeric,
    activity.amount_atomic,
    0::bigint,
    1::bigint
  from public.verified_funding_activity activity
  where activity.recipient_profile_wallet is not null
)
select
  event.profile_wallet,
  event.chain_namespace,
  event.network_reference,
  event.asset,
  sum(event.sent_atomic)::numeric as sent_atomic,
  sum(event.received_atomic)::numeric as received_atomic,
  sum(event.sent_count)::bigint as sent_count,
  sum(event.received_count)::bigint as received_count
from profile_events event
group by
  event.profile_wallet, event.chain_namespace,
  event.network_reference, event.asset;

-- Append exact-asset totals to the established card contracts. Atomic values
-- are JSON strings so PostgREST/JavaScript never rounds a 78-digit integer.
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
  coalesce(media_rows.media, '[]'::jsonb) as media,
  p.view_count,
  author_profile.identity_kind as author_identity_kind,
  author_profile.identity_provider as author_identity_provider,
  coalesce(total_rows.funding_totals, '[]'::jsonb) as funding_totals
from public.posts p
join public.profiles author_profile
  on author_profile.wallet_address = p.author_wallet
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'id', asset.id,
      'kind', asset.kind,
      'public_url', asset.public_url,
      'mime_type', asset.mime_type,
      'width', asset.width,
      'height', asset.height,
      'duration_seconds', asset.duration_seconds,
      'alt_text', asset.alt_text,
      'position', post_media.position
    ) order by post_media.position, asset.created_at
  ) as media
  from public.post_media post_media
  join public.media_assets asset
    on asset.id = post_media.media_id and asset.status = 'published'
  where post_media.post_id = p.id
) media_rows on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'asset', total.asset,
      'received_atomic', total.received_atomic::text,
      'donation_count', total.donation_count
    ) order by total.asset
  ) as funding_totals
  from public.post_funding_totals total
  where total.post_id = p.id
) total_rows on true;

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
  coalesce(media_rows.media, '[]'::jsonb) as media,
  author_profile.identity_kind as author_identity_kind,
  author_profile.identity_provider as author_identity_provider,
  coalesce(total_rows.funding_totals, '[]'::jsonb) as funding_totals
from public.comments c
left join public.profiles author_profile
  on author_profile.wallet_address = c.author_wallet
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'id', asset.id,
      'kind', asset.kind,
      'public_url', asset.public_url,
      'mime_type', asset.mime_type,
      'width', asset.width,
      'height', asset.height,
      'duration_seconds', asset.duration_seconds,
      'alt_text', asset.alt_text,
      'position', comment_media.position
    ) order by comment_media.position, asset.created_at
  ) as media
  from public.comment_media comment_media
  join public.media_assets asset
    on asset.id = comment_media.media_id and asset.status = 'published'
  where comment_media.comment_id = c.id
) media_rows on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'asset', total.asset,
      'received_atomic', total.received_atomic::text,
      'donation_count', total.donation_count
    ) order by total.asset
  ) as funding_totals
  from public.target_funding_totals total
  where total.target_type = 'comment'
    and total.comment_id = c.id
) total_rows on true;

alter table public.funding_assets enable row level security;
create policy public_read on public.funding_assets
for select to anon, authenticated using (true);
revoke all on public.funding_assets from public, anon, authenticated;
grant select on public.funding_assets to anon, authenticated;
grant select, insert, update, delete on public.funding_assets to service_role;

alter table public.profile_funding_routes enable row level security;
create policy public_read on public.profile_funding_routes
for select to anon, authenticated
using (verification_status in ('self_declared', 'verified'));
revoke all on public.profile_funding_routes from public, anon, authenticated;
grant select on public.profile_funding_routes to anon, authenticated;
grant select, insert, update, delete on public.profile_funding_routes to service_role;

alter table public.post_funding_options enable row level security;
create policy public_read on public.post_funding_options
for select to anon, authenticated
using (verification_status in ('self_declared', 'verified'));
revoke all on public.post_funding_options from public, anon, authenticated;
grant select on public.post_funding_options to anon, authenticated;
grant select, insert, update, delete on public.post_funding_options to service_role;

alter table public.funding_intents enable row level security;
create policy clients_denied on public.funding_intents
for all to anon, authenticated using (false) with check (false);
revoke all on public.funding_intents from public, anon, authenticated;
grant select, insert, update, delete on public.funding_intents to service_role;

alter table public.funding_donations enable row level security;
create policy public_read on public.funding_donations
for select to anon, authenticated using (true);
revoke all on public.funding_donations from public, anon, authenticated;
grant select on public.funding_donations to anon, authenticated;
grant select, insert on public.funding_donations to service_role;

revoke all on public.verified_funding_activity from public, anon, authenticated;
revoke all on public.post_funding_totals from public, anon, authenticated;
revoke all on public.target_funding_totals from public, anon, authenticated;
revoke all on public.profile_funding_totals from public, anon, authenticated;
grant select on
  public.verified_funding_activity,
  public.post_funding_totals,
  public.target_funding_totals,
  public.profile_funding_totals
to anon, authenticated, service_role;

revoke all on function internal.is_supported_funding_route(text, text, text, text)
  from public, anon, authenticated;
revoke all on function internal.is_supported_funding_transaction_hash(text, text, text)
  from public, anon, authenticated;
revoke all on function internal.touch_profile_funding_route()
  from public, anon, authenticated;
revoke all on function internal.assert_post_funding_option()
  from public, anon, authenticated;
revoke all on function internal.seed_post_funding_options()
  from public, anon, authenticated;
revoke all on function internal.protect_post_funding_owner()
  from public, anon, authenticated;
revoke all on function internal.sync_saved_route_status()
  from public, anon, authenticated;
revoke all on function internal.upsert_profile_funding_routes(text, jsonb)
  from public, anon, authenticated;
revoke all on function internal.assert_funding_intent()
  from public, anon, authenticated;
revoke all on function internal.protect_funding_intent()
  from public, anon, authenticated;
revoke all on function internal.assert_funding_donation()
  from public, anon, authenticated;
revoke all on function internal.reject_funding_donation_change()
  from public, anon, authenticated;
revoke all on function internal.assert_recorded_funding_intent()
  from public, anon, authenticated;
revoke all on function internal.bind_clerk_existing_profile(
  text, text, text, timestamptz, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.issue_funding_intent(
  text, text, text, numeric, bigint, bigint, uuid, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.get_funding_intent_for_verification(uuid, text)
  from public, anon, authenticated;
revoke all on function public.submit_funding_transaction(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.record_verified_funding_donation(
  uuid, text, text, text, numeric, text, bigint, text, text, bigint, timestamptz
) from public, anon, authenticated;
revoke all on function public.sync_clerk_profile(
  text, text, timestamptz, text, text, timestamptz, boolean
) from public, anon, authenticated;
revoke all on function public.bind_clerk_profile_from_legacy_session(
  text, text, timestamptz, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.bind_clerk_profile_from_verified_wallet(
  text, text, timestamptz, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.bind_clerk_profile_from_verified_external(
  text, text, text, timestamptz, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.get_clerk_profile(text)
  from public, anon, authenticated;
revoke all on function public.publish_post_with_media(
  text, text, text, text, uuid[], jsonb
) from public, anon, authenticated;
revoke all on function public.publish_comment_with_media(
  text, bigint, bigint, text, text, uuid[], jsonb
) from public, anon, authenticated;

grant execute on function internal.is_supported_funding_route(text, text, text, text)
  to service_role;
grant execute on function internal.is_supported_funding_transaction_hash(text, text, text)
  to service_role;
grant execute on function public.issue_funding_intent(
  text, text, text, numeric, bigint, bigint, uuid, uuid, text, text
) to service_role;
grant execute on function public.get_funding_intent_for_verification(uuid, text)
  to service_role;
grant execute on function public.submit_funding_transaction(uuid, text, text)
  to service_role;
grant execute on function public.record_verified_funding_donation(
  uuid, text, text, text, numeric, text, bigint, text, text, bigint, timestamptz
) to service_role;
grant execute on function public.sync_clerk_profile(
  text, text, timestamptz, text, text, timestamptz, boolean
) to service_role;
grant execute on function public.bind_clerk_profile_from_legacy_session(
  text, text, timestamptz, text, text, timestamptz
) to service_role;
grant execute on function public.bind_clerk_profile_from_verified_wallet(
  text, text, timestamptz, text, text, timestamptz
) to service_role;
grant execute on function public.bind_clerk_profile_from_verified_external(
  text, text, text, timestamptz, text, text, timestamptz
) to service_role;
grant execute on function public.get_clerk_profile(text) to service_role;
grant execute on function public.publish_post_with_media(
  text, text, text, text, uuid[], jsonb
) to service_role;
grant execute on function public.publish_comment_with_media(
  text, bigint, bigint, text, text, uuid[], jsonb
) to service_role;

do $$
declare
  expected_options bigint;
  actual_options bigint;
begin
  if (select count(*) from public.funding_assets) <> 10 then
    raise exception 'Funding asset registry seed mismatch';
  end if;

  select count(*) into expected_options
  from public.posts post
  join public.profile_funding_routes route
    on route.profile_wallet = post.author_wallet
   and route.verification_status in ('self_declared', 'verified');
  select count(*) into actual_options from public.post_funding_options;
  if actual_options <> expected_options then
    raise exception 'Post funding option seed mismatch: expected %, got %',
      expected_options, actual_options;
  end if;

  if (select count(*) from public.profiles)
       <> current_setting('money_nerds.pre_profiles')::bigint
     or (select count(*) from public.posts)
       <> current_setting('money_nerds.pre_posts')::bigint
     or (select count(*) from public.comments)
       <> current_setting('money_nerds.pre_comments')::bigint
     or (select count(*) from public.donations)
       <> current_setting('money_nerds.pre_donations')::bigint
     or (select count(*) from public.legacy_unverified_donations)
       <> current_setting('money_nerds.pre_legacy_donations')::bigint then
    raise exception 'Historic profile, content, or donation rows changed unexpectedly';
  end if;
end
$$;

comment on table internal.clerk_profile_links is
  'Private durable Clerk user-to-public-profile mapping with explicit proxy or preserved-account binding provenance. Never expose Clerk ids to browser roles.';
comment on table public.profile_funding_routes is
  'Reusable profile payout destinations; status distinguishes self-declared from ownership-verified routes.';
comment on table public.post_funding_options is
  'Per-post payout snapshots, unique by post and exact asset, validated by trusted server code.';
comment on table public.funding_intents is
  'Private short-lived single-use multichain funding terms derived from a post option, saved profile route, or trusted service destination.';
comment on table public.funding_donations is
  'Immutable public verified multichain transfers with exact on-chain and profile attribution.';
comment on column public.funding_intents.amount_atomic is
  'Integer amount in the exact asset smallest unit; serialize as a decimal string in JavaScript.';
comment on column public.funding_intents.submission_status is
  'Private lifecycle: issued, submitted for asynchronous verification, then verified. Submitted alone never affects public totals.';
comment on column public.funding_donations.transfer_index is
  'Chain-specific transfer position: Solana instruction, EVM log, Bitcoin vout, TRON event, or TON message index.';

commit;
