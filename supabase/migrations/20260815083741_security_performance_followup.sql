begin;

-- Storage signed-upload tokens do not require ordinary table-write privileges.
-- Remove Supabase's broad default grants so anon/authenticated can only read
-- public objects and cannot attempt direct object mutations.
revoke insert, update, delete, truncate, references, trigger
on storage.objects from anon, authenticated;
grant select on storage.objects to anon, authenticated;

-- Cover every foreign-key lookup direction reported by the production advisor.
create index if not exists legacy_auth_wallet_links_wallet_idx
  on internal.legacy_auth_wallet_links (wallet_address);
create index if not exists comment_media_media_idx
  on public.comment_media (media_id);
create index if not exists comments_parent_idx
  on public.comments (parent_id) where parent_id is not null;
create index if not exists legacy_donations_recipient_idx
  on public.legacy_unverified_donations (recipient_wallet, post_id);
create index if not exists post_media_media_idx
  on public.post_media (media_id);

commit;
