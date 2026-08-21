begin;

-- Keep homepage statistics a constant-size read as the public ledger grows.
create or replace view public.site_stats
with (security_invoker = true)
as
select
  (select count(*)::bigint from public.posts) as post_count,
  (select count(*)::bigint from public.profiles) as profile_count,
  (
    select coalesce(sum(d.lamports), 0)::bigint
    from public.donations d
    where d.status = 'verified'
  ) as verified_donation_lamports;

revoke all on public.site_stats from public, anon, authenticated;
grant select on public.site_stats to anon, authenticated, service_role;

commit;
