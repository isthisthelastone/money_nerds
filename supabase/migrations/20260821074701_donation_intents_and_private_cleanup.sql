begin;

-- A public donation record must be tied to a fresh, server-issued intent. The
-- intent is private, short-lived, single-use, and later referenced by an on-chain
-- memo so an unrelated historical transfer cannot be relabelled as support for a
-- Money Nerds post or comment.
create table if not exists public.donation_intents (
  id uuid primary key default gen_random_uuid(),
  donor_wallet text not null references public.profiles(wallet_address)
    on update cascade on delete restrict,
  recipient_wallet text not null,
  target_type text not null,
  post_id bigint references public.posts(id) on delete cascade,
  comment_id bigint references public.comments(id) on delete cascade,
  lamports bigint not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz,
  used_signature text unique,
  constraint donation_intents_target_shape check (
    (target_type = 'post' and post_id is not null and comment_id is null)
    or (target_type = 'comment' and comment_id is not null and post_id is null)
    or (target_type = 'service' and post_id is null and comment_id is null)
  ),
  constraint donation_intents_target_type check (
    target_type in ('post', 'comment', 'service')
  ),
  constraint donation_intents_wallet_shapes check (
    donor_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and recipient_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  ),
  constraint donation_intents_amount check (
    lamports between 1 and 100000000000000
  ),
  constraint donation_intents_expiry check (
    expires_at > created_at and expires_at <= created_at + interval '15 minutes'
  ),
  constraint donation_intents_use_shape check (
    (used_at is null and used_signature is null)
    or (
      used_at is not null
      and used_signature is not null
      and used_signature ~ '^[1-9A-HJ-NP-Za-km-z]{80,90}$'
      and used_at >= created_at
    )
  )
);

create index if not exists donation_intents_donor_rate_idx
  on public.donation_intents (donor_wallet, created_at desc);
create index if not exists donation_intents_expiry_idx
  on public.donation_intents (expires_at)
  where used_signature is null;
create index if not exists donation_intents_post_idx
  on public.donation_intents (post_id, created_at desc)
  where post_id is not null;
create index if not exists donation_intents_comment_idx
  on public.donation_intents (comment_id, created_at desc)
  where comment_id is not null;

alter table public.donation_intents enable row level security;
drop policy if exists clients_denied on public.donation_intents;
create policy clients_denied on public.donation_intents
for all to anon, authenticated using (false) with check (false);
revoke all on public.donation_intents from public, anon, authenticated;
grant select, insert, update, delete on public.donation_intents to service_role;

-- The legacy mapping was already protected by schema/table ACLs. Enabling RLS
-- adds a second boundary and clears the generic database security lint.
alter table internal.legacy_auth_wallet_links enable row level security;

create or replace function public.issue_donation_intent(
  p_donor_wallet text,
  p_recipient_wallet text,
  p_target_type text,
  p_post_id bigint default null,
  p_comment_id bigint default null,
  p_lamports bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent_id uuid;
  intent_expiry timestamptz;
  expected_recipient text;
  recent_count bigint;
begin
  p_donor_wallet := btrim(coalesce(p_donor_wallet, ''));
  p_recipient_wallet := btrim(coalesce(p_recipient_wallet, ''));
  p_target_type := lower(btrim(coalesce(p_target_type, '')));

  if p_donor_wallet !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
     or p_recipient_wallet !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    raise exception 'Invalid Solana wallet address';
  end if;
  if p_donor_wallet = p_recipient_wallet then
    raise exception 'A wallet cannot fund itself';
  end if;
  if p_lamports is null or p_lamports < 1 or p_lamports > 100000000000000 then
    raise exception 'Invalid donation amount';
  end if;

  if p_target_type = 'post' and p_post_id is not null and p_comment_id is null then
    select p.author_wallet into expected_recipient
    from public.posts p where p.id = p_post_id;
  elsif p_target_type = 'comment' and p_comment_id is not null and p_post_id is null then
    select c.author_wallet into expected_recipient
    from public.comments c where c.id = p_comment_id;
  elsif p_target_type = 'service' and p_post_id is null and p_comment_id is null then
    expected_recipient := p_recipient_wallet;
  else
    raise exception 'Invalid donation target';
  end if;

  if expected_recipient is null then
    raise exception 'Donation target has no valid recipient wallet';
  end if;
  if expected_recipient <> p_recipient_wallet then
    raise exception 'Donation recipient does not match target';
  end if;

  -- Serialize issuance per wallet so concurrent requests cannot race the limit.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('money-nerds-donation:' || p_donor_wallet, 0)
  );
  select count(*) into recent_count
  from public.donation_intents i
  where i.donor_wallet = p_donor_wallet
    and i.created_at >= now() - interval '1 minute';
  if recent_count >= 12 then
    raise exception 'Donation intent rate limit exceeded';
  end if;

  intent_expiry := now() + interval '10 minutes';
  insert into public.donation_intents (
    donor_wallet, recipient_wallet, target_type, post_id, comment_id,
    lamports, expires_at
  ) values (
    p_donor_wallet, p_recipient_wallet, p_target_type, p_post_id, p_comment_id,
    p_lamports, intent_expiry
  )
  returning id into intent_id;

  return jsonb_build_object(
    'id', intent_id,
    'recipient_wallet', p_recipient_wallet,
    'lamports', p_lamports,
    'expires_at', intent_expiry
  );
end
$$;

create or replace function public.record_verified_donation(
  p_intent_id uuid,
  p_signature text,
  p_instruction_index integer,
  p_slot bigint,
  p_transaction_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent public.donation_intents%rowtype;
begin
  p_signature := btrim(coalesce(p_signature, ''));
  if p_intent_id is null then
    raise exception 'Donation intent is required';
  end if;
  if p_signature !~ '^[1-9A-HJ-NP-Za-km-z]{80,90}$' then
    raise exception 'Invalid transaction signature';
  end if;
  if p_instruction_index is null or p_instruction_index < 0
     or p_slot is null or p_slot < 1 then
    raise exception 'Invalid transaction position';
  end if;
  if p_transaction_created_at is null then
    raise exception 'Transaction timestamp is required';
  end if;

  select i.* into intent
  from public.donation_intents i
  where i.id = p_intent_id
  for update;
  if not found then raise exception 'Donation intent does not exist'; end if;

  if intent.used_signature is not null or intent.used_at is not null then
    if intent.used_signature = p_signature and exists (
      select 1
      from public.donations d
      where d.signature = p_signature
        and d.network = 'mainnet-beta'
        and d.instruction_index = p_instruction_index
        and d.donor_wallet = intent.donor_wallet
        and d.recipient_wallet = intent.recipient_wallet
        and d.target_type = intent.target_type
        and d.post_id is not distinct from intent.post_id
        and d.comment_id is not distinct from intent.comment_id
        and d.lamports = intent.lamports
        and d.slot = p_slot
        and d.created_at = p_transaction_created_at
    ) then
      return jsonb_build_object(
        'verified', true,
        'signature', p_signature,
        'already_recorded', true
      );
    end if;
    raise exception 'Donation intent was already used';
  end if;
  if p_transaction_created_at < intent.created_at - interval '2 minutes'
     or p_transaction_created_at > intent.expires_at + interval '2 minutes'
     or p_transaction_created_at > now() + interval '2 minutes' then
    raise exception 'Transaction timestamp does not match donation intent';
  end if;

  insert into public.donations (
    signature, network, instruction_index, donor_wallet, recipient_wallet,
    target_type, post_id, comment_id, lamports, slot, status, verified_at,
    created_at
  ) values (
    p_signature, 'mainnet-beta', p_instruction_index, intent.donor_wallet,
    intent.recipient_wallet, intent.target_type, intent.post_id,
    intent.comment_id, intent.lamports, p_slot, 'verified', now(),
    p_transaction_created_at
  );

  update public.donation_intents
  set used_at = now(), used_signature = p_signature
  where id = intent.id
    and used_at is null
    and used_signature is null;
  if not found then
    raise exception 'Donation intent was already used';
  end if;

  return jsonb_build_object(
    'verified', true,
    'signature', p_signature,
    'already_recorded', false
  );
end
$$;

create or replace function public.prune_expired_private_rows()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenges_deleted bigint;
  sessions_deleted bigint;
  intents_deleted bigint;
begin
  delete from public.wallet_challenges
  where expires_at < now() - interval '1 hour';
  get diagnostics challenges_deleted = row_count;

  delete from public.wallet_sessions
  where expires_at < now() - interval '7 days'
     or revoked_at < now() - interval '7 days';
  get diagnostics sessions_deleted = row_count;

  delete from public.donation_intents
  where used_signature is null
    and expires_at < now() - interval '7 days';
  get diagnostics intents_deleted = row_count;

  return jsonb_build_object(
    'wallet_challenges', challenges_deleted,
    'wallet_sessions', sessions_deleted,
    'donation_intents', intents_deleted
  );
end
$$;

revoke all on function public.issue_donation_intent(text, text, text, bigint, bigint, bigint)
  from public, anon, authenticated;
revoke all on function public.record_verified_donation(uuid, text, integer, bigint, timestamptz)
  from public, anon, authenticated;
revoke all on function public.prune_expired_private_rows()
  from public, anon, authenticated;
grant execute on function public.issue_donation_intent(text, text, text, bigint, bigint, bigint)
  to service_role;
grant execute on function public.record_verified_donation(uuid, text, integer, bigint, timestamptz)
  to service_role;
grant execute on function public.prune_expired_private_rows() to service_role;

commit;
