-- Optional bot-assisted login. No existing OIDC, user or profile tables change.
-- All random proofs are SHA-256 hashes; plaintext return claims are never stored.
create table public.telegram_bot_pending (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  browser_hash text not null check (browser_hash ~ '^[a-f0-9]{64}$'),
  callback_hash text check (callback_hash ~ '^[a-f0-9]{64}$'),
  return_claim_hash text unique check (return_claim_hash ~ '^[a-f0-9]{64}$'),
  expected_sender text check (expected_sender ~ '^[1-9][0-9]{0,19}$'),
  telegram_subject text check (telegram_subject ~ '^[1-9][0-9]{0,19}$'),
  telegram_first_name text check (length(telegram_first_name) <= 256),
  telegram_last_name text check (length(telegram_last_name) <= 256),
  telegram_auth_hash text unique check (telegram_auth_hash ~ '^[a-f0-9]{64}$'),
  return_to text not null default '/' check (length(return_to) <= 512 and return_to like '/%' and return_to not like '//%'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  approved_at timestamptz,
  consumed_at timestamptz,
  constraint telegram_bot_lifetime check (expires_at > created_at and expires_at <= created_at + interval '10 minutes'),
  constraint telegram_bot_approval_complete check (
    (approved_at is null and return_claim_hash is null and telegram_subject is null and telegram_auth_hash is null)
    or (approved_at is not null and return_claim_hash is not null and telegram_subject = expected_sender and telegram_auth_hash is not null)
  ),
  constraint telegram_bot_consumption_requires_approval check (consumed_at is null or approved_at is not null)
);
create index telegram_bot_pending_expiry_idx on public.telegram_bot_pending(expires_at);

create table public.telegram_bot_webhook_updates (
  update_id bigint primary key check (update_id >= 0),
  locked_at timestamptz not null default now(),
  completed boolean not null default false
);
create index telegram_bot_webhook_updates_expiry_idx on public.telegram_bot_webhook_updates(locked_at);

alter table public.telegram_bot_pending enable row level security;
alter table public.telegram_bot_webhook_updates enable row level security;
create policy telegram_bot_pending_browser_deny on public.telegram_bot_pending
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy telegram_bot_updates_browser_deny on public.telegram_bot_webhook_updates
  as restrictive for all to anon, authenticated using (false) with check (false);
revoke all on public.telegram_bot_pending, public.telegram_bot_webhook_updates from public, anon, authenticated;
grant select, insert, update, delete on public.telegram_bot_pending, public.telegram_bot_webhook_updates to service_role;
comment on table public.telegram_bot_pending is 'Private 10-minute bot login attempts. Cookie AND return claim are required. Never expose to browser API roles or polling.';

create function public.create_telegram_bot_attempt(p_state_hash text, p_browser_hash text, p_return_to text)
returns text language plpgsql security invoker set search_path = '' as $$
declare expiry timestamptz;
begin
  -- Retain proof replay digests beyond the accepted proof lifetime. No live
  -- approval can be revived by cleanup; expired records are not consumable.
  delete from public.telegram_bot_pending where expires_at < now() - interval '10 minutes';
  delete from public.telegram_bot_webhook_updates where locked_at < now() - interval '48 hours';
  insert into public.telegram_bot_pending(state_hash, browser_hash, return_to)
    values (p_state_hash, p_browser_hash, p_return_to)
    returning expires_at into expiry;
  return expiry::text;
end;
$$;

create function public.claim_telegram_bot_update(p_update_id bigint)
returns text language plpgsql security invoker set search_path = '' as $$
declare did_insert bigint; is_completed boolean;
begin
  insert into public.telegram_bot_webhook_updates(update_id) values (p_update_id)
    on conflict do nothing returning update_id into did_insert;
  if did_insert is not null then return 'acquired'; end if;
  select completed into is_completed from public.telegram_bot_webhook_updates where update_id = p_update_id;
  if is_completed then return 'done'; end if;
  -- Delivery is bounded to 10 seconds. Permit recovery after an interrupted
  -- worker, while concurrent duplicate updates receive a retriable response.
  update public.telegram_bot_webhook_updates set locked_at = now()
    where update_id = p_update_id and not completed and locked_at < now() - interval '60 seconds';
  if found then return 'acquired'; end if;
  return 'busy';
end;
$$;

create function public.bind_telegram_bot_sender(p_state_hash text, p_sender text, p_callback_hash text, p_message_date timestamptz)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.telegram_bot_pending
    set expected_sender = p_sender, callback_hash = p_callback_hash
    where state_hash = p_state_hash and approved_at is null and consumed_at is null and expires_at > now()
      and (expected_sender is null or expected_sender = p_sender)
      and p_message_date >= created_at - interval '30 seconds' and p_message_date <= now() + interval '30 seconds';
  return found;
end;
$$;

create function public.approve_telegram_bot_attempt(
  p_state_hash text, p_callback_hash text, p_sender text, p_auth_date timestamptz,
  p_auth_hash text, p_return_claim_hash text, p_first_name text, p_last_name text
)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.telegram_bot_pending
    set telegram_subject = p_sender, telegram_first_name = p_first_name, telegram_last_name = p_last_name,
      telegram_auth_hash = p_auth_hash, return_claim_hash = p_return_claim_hash, approved_at = now()
    where state_hash = p_state_hash and callback_hash = p_callback_hash and expected_sender = p_sender
      and approved_at is null and consumed_at is null and expires_at > now()
      and p_auth_date >= created_at - interval '30 seconds'
      and p_auth_date >= now() - interval '10 minutes' and p_auth_date <= now() + interval '30 seconds';
  return found;
end;
$$;

create function public.consume_telegram_bot_attempt(p_state_hash text, p_browser_hash text, p_return_claim_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare attempt public.telegram_bot_pending%rowtype;
begin
  -- Atomic compare-and-consume: approval polling is never sufficient, and two
  -- concurrent confirmations cannot issue two Clerk tickets from one claim.
  update public.telegram_bot_pending set consumed_at = now()
    where state_hash = p_state_hash and browser_hash = p_browser_hash and return_claim_hash = p_return_claim_hash
      and approved_at is not null and consumed_at is null and expires_at > now()
    returning * into attempt;
  if not found then return null; end if;
  return jsonb_build_object(
    'telegram_subject', attempt.telegram_subject, 'telegram_first_name', attempt.telegram_first_name,
    'telegram_last_name', attempt.telegram_last_name, 'return_to', attempt.return_to
  );
end;
$$;

revoke all on function public.create_telegram_bot_attempt(text, text, text) from public, anon, authenticated;
revoke all on function public.claim_telegram_bot_update(bigint) from public, anon, authenticated;
revoke all on function public.bind_telegram_bot_sender(text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.approve_telegram_bot_attempt(text, text, text, timestamptz, text, text, text, text) from public, anon, authenticated;
revoke all on function public.consume_telegram_bot_attempt(text, text, text) from public, anon, authenticated;
grant execute on function public.create_telegram_bot_attempt(text, text, text) to service_role;
grant execute on function public.claim_telegram_bot_update(bigint) to service_role;
grant execute on function public.bind_telegram_bot_sender(text, text, text, timestamptz) to service_role;
grant execute on function public.approve_telegram_bot_attempt(text, text, text, timestamptz, text, text, text, text) to service_role;
grant execute on function public.consume_telegram_bot_attempt(text, text, text) to service_role;
