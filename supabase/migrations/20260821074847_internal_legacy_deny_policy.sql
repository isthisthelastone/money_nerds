begin;

drop policy if exists clients_denied on internal.legacy_auth_wallet_links;
create policy clients_denied on internal.legacy_auth_wallet_links
for all to anon, authenticated using (false) with check (false);

revoke all on internal.legacy_auth_wallet_links from public, anon, authenticated;

commit;
