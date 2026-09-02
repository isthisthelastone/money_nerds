begin;

-- Cover the new multi-column funding-asset foreign keys. Keeping asset first
-- also covers each table's direct asset foreign key.
create index if not exists profile_funding_routes_asset_network_fk_idx
  on public.profile_funding_routes (asset, chain_namespace, network_reference);

create index if not exists post_funding_options_asset_network_fk_idx
  on public.post_funding_options (asset, chain_namespace, network_reference);

create index if not exists funding_intents_asset_network_fk_idx
  on public.funding_intents (asset, chain_namespace, network_reference);

create index if not exists funding_donations_asset_network_fk_idx
  on public.funding_donations (asset, chain_namespace, network_reference);

-- Support parent updates/deletes without scanning the private intent/option
-- ledgers. Partial indexes avoid storing rows where the relationship is absent.
create index if not exists funding_intents_recipient_profile_fk_idx
  on public.funding_intents (recipient_profile_wallet)
  where recipient_profile_wallet is not null;

create index if not exists post_funding_options_profile_route_fk_idx
  on public.post_funding_options (profile_funding_route_id)
  where profile_funding_route_id is not null;

commit;
