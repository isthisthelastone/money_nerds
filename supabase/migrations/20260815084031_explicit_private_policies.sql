begin;

-- These tables intentionally expose nothing to browser roles. Explicit deny
-- policies document that posture and keep the database advisor unambiguous;
-- the service role continues to bypass RLS for trusted server routes.
drop policy if exists clients_denied on public.wallet_challenges;
create policy clients_denied on public.wallet_challenges
for all to anon, authenticated using (false) with check (false);

drop policy if exists clients_denied on public.wallet_sessions;
create policy clients_denied on public.wallet_sessions
for all to anon, authenticated using (false) with check (false);

commit;
