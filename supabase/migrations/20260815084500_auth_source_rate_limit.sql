begin;

alter table public.wallet_challenges
  add column if not exists request_fingerprint text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wallet_challenges_fingerprint'
      and conrelid = 'public.wallet_challenges'::regclass
  ) then
    alter table public.wallet_challenges
      add constraint wallet_challenges_fingerprint check (
        request_fingerprint is null or request_fingerprint ~ '^[0-9a-f]{64}$'
      );
  end if;
end
$$;

create index if not exists wallet_challenges_source_rate_idx
  on public.wallet_challenges (request_fingerprint, created_at desc)
  where request_fingerprint is not null;

commit;
