begin;

create index if not exists wallet_challenges_rate_idx
  on public.wallet_challenges (wallet_address, created_at desc);
create index if not exists wallet_challenges_created_idx
  on public.wallet_challenges (created_at desc);

commit;
