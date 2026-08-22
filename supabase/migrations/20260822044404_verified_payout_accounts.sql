begin;

-- Ownership evidence stays in the non-exposed internal schema. Public rows contain
-- only routes that have a matching, active proof; no raw challenge, signature,
-- provider subject, or other proof material is browser-readable.
create table internal.payout_account_proofs (
  id uuid primary key default gen_random_uuid(),
  profile_wallet text not null references public.profiles(wallet_address)
    on update cascade on delete restrict,
  chain_namespace text not null,
  network_reference text not null,
  normalized_address text not null,
  verification_method text not null,
  proof_payload jsonb not null,
  proof_digest text not null,
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payout_account_proofs_namespace_length check (
    char_length(chain_namespace) between 2 and 16
  ),
  constraint payout_account_proofs_network_length check (
    char_length(network_reference) between 1 and 64
  ),
  constraint payout_account_proofs_address_length check (
    char_length(normalized_address) between 10 and 128
  ),
  constraint payout_account_proofs_method_shape check (
    verification_method ~ '^[a-z][a-z0-9_]{2,63}$'
  ),
  constraint payout_account_proofs_payload_shape check (
    jsonb_typeof(proof_payload) = 'object'
    and octet_length(proof_payload::text) between 2 and 32768
  ),
  constraint payout_account_proofs_digest_shape check (
    proof_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint payout_account_proofs_revocation_time check (
    revoked_at is null or revoked_at >= verified_at
  )
);

create table public.verified_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_wallet text not null references public.profiles(wallet_address)
    on update cascade on delete cascade,
  chain_namespace text not null,
  network_reference text not null,
  asset text not null,
  normalized_address text not null,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verified_payout_accounts_namespace_length check (
    char_length(chain_namespace) between 2 and 16
  ),
  constraint verified_payout_accounts_network_length check (
    char_length(network_reference) between 1 and 64
  ),
  constraint verified_payout_accounts_asset_length check (
    char_length(asset) between 2 and 32
  ),
  constraint verified_payout_accounts_address_length check (
    char_length(normalized_address) between 10 and 128
  ),
  unique (
    profile_wallet, chain_namespace, network_reference, asset,
    normalized_address
  )
);

-- Network references mirror Reown/CAIP identifiers, while asset names disambiguate
-- native currency from token transfers that share the same recipient address.
create or replace function internal.is_supported_payout_address(
  p_chain_namespace text,
  p_network_reference text,
  p_normalized_address text
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
      then p_normalized_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
        and p_normalized_address <> '11111111111111111111111111111111'
    when p_chain_namespace = 'eip155'
      and p_network_reference in ('1', '1776')
      then p_normalized_address ~ '^0x[0-9a-f]{40}$'
        and p_normalized_address <> '0x0000000000000000000000000000000000000000'
    when p_chain_namespace = 'bip122'
      and p_network_reference = '000000000019d6689c085ae165831e93'
      then p_normalized_address ~ '^[13][1-9A-HJ-NP-Za-km-z]{25,34}$'
        or p_normalized_address ~ '^bc1[ac-hj-np-z02-9]{11,71}$'
    when p_chain_namespace = 'tron'
      and p_network_reference = '0x2b6653dc'
      then p_normalized_address ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$'
    when p_chain_namespace = 'ton'
      and p_network_reference = '-239'
      then p_normalized_address ~ '^(-1|0):[0-9a-f]{64}$'
        and p_normalized_address !~ '^(-1|0):0{64}$'
    else false
  end
$$;

create or replace function internal.is_supported_payout_route(
  p_chain_namespace text,
  p_network_reference text,
  p_asset text,
  p_normalized_address text
)
returns boolean
language sql
immutable
returns null on null input
set search_path = ''
as $$
  select internal.is_supported_payout_address(
    p_chain_namespace, p_network_reference, p_normalized_address
  ) and case
    when p_chain_namespace = 'solana'
      and p_network_reference = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
      then p_asset = 'SOL'
    when p_chain_namespace = 'eip155' and p_network_reference = '1'
      then p_asset in ('ETH', 'USDT-ERC20')
    when p_chain_namespace = 'eip155' and p_network_reference = '1776'
      then p_asset = 'INJ'
    when p_chain_namespace = 'bip122'
      and p_network_reference = '000000000019d6689c085ae165831e93'
      then p_asset = 'BTC'
    when p_chain_namespace = 'tron' and p_network_reference = '0x2b6653dc'
      then p_asset in ('TRX', 'USDT-TRC20')
    when p_chain_namespace = 'ton' and p_network_reference = '-239'
      then p_asset = 'TON'
    else false
  end
$$;

alter table internal.payout_account_proofs
  add constraint payout_account_proofs_supported_address check (
    internal.is_supported_payout_address(
      chain_namespace, network_reference, normalized_address
    )
  );

alter table public.verified_payout_accounts
  add constraint verified_payout_accounts_supported_route check (
    internal.is_supported_payout_route(
      chain_namespace, network_reference, asset, normalized_address
    )
  );

create unique index payout_account_proofs_active_owner_idx
  on internal.payout_account_proofs (
    profile_wallet, chain_namespace, network_reference, normalized_address
  ) where revoked_at is null;
create unique index payout_account_proofs_active_address_owner_idx
  on internal.payout_account_proofs (
    chain_namespace, network_reference, normalized_address
  ) where revoked_at is null;
create index payout_account_proofs_profile_history_idx
  on internal.payout_account_proofs (profile_wallet, created_at desc);
create index verified_payout_accounts_profile_idx
  on public.verified_payout_accounts (
    profile_wallet, chain_namespace, network_reference, asset, verified_at desc
  );
create index verified_payout_accounts_address_idx
  on public.verified_payout_accounts (
    chain_namespace, network_reference, normalized_address
  );

-- This lookup deliberately tolerates either migration order. External identity
-- rows do not exist on installations without that optional authentication layer.
create or replace function internal.is_external_proxy_profile(p_profile_wallet text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  is_proxy boolean := false;
begin
  if to_regclass('internal.external_identity_links') is null then
    return false;
  end if;
  execute 'select exists (
    select 1 from internal.external_identity_links
    where proxy_wallet_address = $1
  )' into is_proxy using p_profile_wallet;
  return is_proxy;
end
$$;

create or replace function internal.prepare_payout_account_proof()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if internal.is_external_proxy_profile(new.profile_wallet)
     and new.normalized_address = new.profile_wallet then
    raise exception 'An external identity proxy cannot be its own payout address';
  end if;
  new.proof_digest := encode(
    extensions.digest(convert_to(new.proof_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );
  return new;
end
$$;

create or replace function internal.protect_payout_account_proof()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.profile_wallet is distinct from old.profile_wallet
     or new.chain_namespace is distinct from old.chain_namespace
     or new.network_reference is distinct from old.network_reference
     or new.normalized_address is distinct from old.normalized_address
     or new.verification_method is distinct from old.verification_method
     or new.proof_payload is distinct from old.proof_payload
     or new.proof_digest is distinct from old.proof_digest
     or new.verified_at is distinct from old.verified_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Payout ownership proofs are immutable';
  end if;
  if old.revoked_at is not null or new.revoked_at is null then
    raise exception 'A payout proof can only transition once to revoked';
  end if;
  return new;
end
$$;

create or replace function internal.remove_routes_for_inactive_payout_proof()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.verified_payout_accounts account
  where account.profile_wallet = old.profile_wallet
    and account.chain_namespace = old.chain_namespace
    and account.network_reference = old.network_reference
    and account.normalized_address = old.normalized_address;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create or replace function internal.assert_verified_payout_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A route inserted and then removed in the same transaction needs no proof at
  -- commit; this also makes proxy cleanup migration-order independent.
  if not exists (
    select 1 from public.verified_payout_accounts account where account.id = new.id
  ) then
    return new;
  end if;
  if internal.is_external_proxy_profile(new.profile_wallet)
     and new.normalized_address = new.profile_wallet then
    raise exception 'An external identity proxy cannot be its own payout address';
  end if;
  if not exists (
    select 1
    from internal.payout_account_proofs proof
    where proof.profile_wallet = new.profile_wallet
      and proof.chain_namespace = new.chain_namespace
      and proof.network_reference = new.network_reference
      and proof.normalized_address = new.normalized_address
      and proof.verified_at = new.verified_at
      and proof.revoked_at is null
  ) then
    raise exception 'A verified payout route requires matching active ownership proof';
  end if;
  return new;
end
$$;

create or replace function internal.touch_verified_payout_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create or replace function internal.revoke_external_proxy_payouts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update internal.payout_account_proofs proof
  set revoked_at = coalesce(proof.revoked_at, now())
  where proof.profile_wallet = new.proxy_wallet_address
    and proof.normalized_address = new.proxy_wallet_address
    and proof.revoked_at is null;
  delete from public.verified_payout_accounts account
  where account.profile_wallet = new.proxy_wallet_address
    and account.normalized_address = new.proxy_wallet_address;
  return new;
end
$$;

drop trigger if exists prepare_payout_account_proof on internal.payout_account_proofs;
create trigger prepare_payout_account_proof
before insert on internal.payout_account_proofs
for each row execute function internal.prepare_payout_account_proof();

drop trigger if exists protect_payout_account_proof on internal.payout_account_proofs;
create trigger protect_payout_account_proof
before update on internal.payout_account_proofs
for each row execute function internal.protect_payout_account_proof();

drop trigger if exists remove_routes_for_revoked_payout_proof
  on internal.payout_account_proofs;
create trigger remove_routes_for_revoked_payout_proof
after update of revoked_at on internal.payout_account_proofs
for each row when (new.revoked_at is not null)
execute function internal.remove_routes_for_inactive_payout_proof();

drop trigger if exists remove_routes_for_deleted_payout_proof
  on internal.payout_account_proofs;
create trigger remove_routes_for_deleted_payout_proof
after delete on internal.payout_account_proofs
for each row execute function internal.remove_routes_for_inactive_payout_proof();

drop trigger if exists verified_payout_accounts_require_proof
  on public.verified_payout_accounts;
create constraint trigger verified_payout_accounts_require_proof
after insert or update of profile_wallet, chain_namespace, network_reference,
  normalized_address, verified_at
on public.verified_payout_accounts
deferrable initially deferred
for each row execute function internal.assert_verified_payout_account();

drop trigger if exists verified_payout_accounts_touch_updated_at
  on public.verified_payout_accounts;
create trigger verified_payout_accounts_touch_updated_at
before update on public.verified_payout_accounts
for each row execute function internal.touch_verified_payout_account();

-- The social migration currently runs first. This conditional DDL preserves the
-- same invariant if these migrations are reordered in a fresh environment.
do $$
begin
  if to_regclass('internal.external_identity_links') is not null then
    execute 'drop trigger if exists revoke_external_proxy_payouts
      on internal.external_identity_links';
    execute 'create trigger revoke_external_proxy_payouts
      after insert or update of proxy_wallet_address
      on internal.external_identity_links
      for each row execute function internal.revoke_external_proxy_payouts()';
  end if;
end
$$;

-- Existing wallet-backed profiles are the only migration-time trust exception.
-- Their profile key is already the Solana payout key. Provider-generated proxy
-- identities are excluded from self-address legacy seeding; they may later own
-- a different payout address after completing an independent ownership proof.
insert into internal.payout_account_proofs (
  profile_wallet,
  chain_namespace,
  network_reference,
  normalized_address,
  verification_method,
  proof_payload,
  verified_at
)
select
  profile.wallet_address,
  'solana',
  '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  profile.wallet_address,
  'legacy_profile_migration',
  jsonb_build_object(
    'attestation', 'existing wallet-backed profile',
    'source', 'public.profiles.wallet_address',
    'migration', '20260822170000_verified_payout_accounts'
  ),
  now()
from public.profiles profile
where not internal.is_external_proxy_profile(profile.wallet_address)
on conflict (
  profile_wallet, chain_namespace, network_reference, normalized_address
) where revoked_at is null do nothing;

insert into public.verified_payout_accounts (
  profile_wallet,
  chain_namespace,
  network_reference,
  asset,
  normalized_address,
  verified_at
)
select
  proof.profile_wallet,
  proof.chain_namespace,
  proof.network_reference,
  'SOL',
  proof.normalized_address,
  proof.verified_at
from internal.payout_account_proofs proof
where proof.chain_namespace = 'solana'
  and proof.network_reference = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
  and proof.normalized_address = proof.profile_wallet
  and proof.revoked_at is null
  and not internal.is_external_proxy_profile(proof.profile_wallet)
on conflict (
  profile_wallet, chain_namespace, network_reference, asset,
  normalized_address
) do nothing;

-- Flush the deferred proof invariant before ALTER TABLE below. PostgreSQL does
-- not permit table DDL while a relation still has pending deferred trigger
-- events from the seed inserts.
set constraints verified_payout_accounts_require_proof immediate;

alter table internal.payout_account_proofs enable row level security;
drop policy if exists clients_denied on internal.payout_account_proofs;
create policy clients_denied on internal.payout_account_proofs
for all to anon, authenticated using (false) with check (false);
revoke all on internal.payout_account_proofs from public, anon, authenticated;
grant select, insert, update, delete on internal.payout_account_proofs to service_role;

alter table public.verified_payout_accounts enable row level security;
drop policy if exists public_read on public.verified_payout_accounts;
create policy public_read on public.verified_payout_accounts
for select to anon, authenticated using (true);
revoke all on public.verified_payout_accounts from public, anon, authenticated;
grant select on public.verified_payout_accounts to anon, authenticated;
grant select, insert, update, delete on public.verified_payout_accounts to service_role;

revoke all on function internal.is_supported_payout_address(text, text, text)
  from public, anon, authenticated;
revoke all on function internal.is_supported_payout_route(text, text, text, text)
  from public, anon, authenticated;
revoke all on function internal.is_external_proxy_profile(text)
  from public, anon, authenticated;
revoke all on function internal.prepare_payout_account_proof()
  from public, anon, authenticated;
revoke all on function internal.protect_payout_account_proof()
  from public, anon, authenticated;
revoke all on function internal.remove_routes_for_inactive_payout_proof()
  from public, anon, authenticated;
revoke all on function internal.assert_verified_payout_account()
  from public, anon, authenticated;
revoke all on function internal.touch_verified_payout_account()
  from public, anon, authenticated;
revoke all on function internal.revoke_external_proxy_payouts()
  from public, anon, authenticated;
grant execute on function internal.is_supported_payout_address(text, text, text)
  to service_role;
grant execute on function internal.is_supported_payout_route(text, text, text, text)
  to service_role;
grant execute on function internal.is_external_proxy_profile(text)
  to service_role;

do $$
declare
  expected_wallet_profiles bigint;
  seeded_sol_routes bigint;
  proxy_routes bigint;
begin
  select count(*) into expected_wallet_profiles
  from public.profiles profile
  where not internal.is_external_proxy_profile(profile.wallet_address);

  select count(*) into seeded_sol_routes
  from public.verified_payout_accounts account
  where account.chain_namespace = 'solana'
    and account.network_reference = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
    and account.asset = 'SOL'
    and account.normalized_address = account.profile_wallet;

  if seeded_sol_routes <> expected_wallet_profiles then
    raise exception 'Verified SOL payout seed mismatch: expected %, got %',
      expected_wallet_profiles, seeded_sol_routes;
  end if;

  select count(*) into proxy_routes
  from public.verified_payout_accounts account
  where internal.is_external_proxy_profile(account.profile_wallet)
    and account.normalized_address = account.profile_wallet;
  if proxy_routes <> 0 then
    raise exception 'External identity proxy self-payout seed detected: % rows', proxy_routes;
  end if;
end
$$;

comment on table internal.payout_account_proofs is
  'Service-only ownership evidence for payout addresses; never expose proof payloads to clients.';
comment on table public.verified_payout_accounts is
  'Public-safe payout routes backed by active private ownership proof. Presence means verified.';
comment on column public.verified_payout_accounts.network_reference is
  'CAIP-2 network reference; combine with chain_namespace for the full chain ID.';
comment on column public.verified_payout_accounts.asset is
  'Exact supported funding asset, including token standard where needed.';

commit;
