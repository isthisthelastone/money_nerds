create table public.profile_preferences (
  wallet_address text primary key references public.profiles(wallet_address) on delete cascade,
  locale text check (locale is null or locale in ('en', 'es', 'zh', 'ru', 'vi')),
  legal_country text check (legal_country is null or legal_country in (
    'GLOBAL','AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','US','RU','SG','MY'
  )),
  updated_at timestamptz not null default now()
);
alter table public.profile_preferences enable row level security;
revoke all on public.profile_preferences from public, anon, authenticated;
grant select, insert, update, delete on public.profile_preferences to service_role;
create policy "No direct access to private preferences" on public.profile_preferences
  for all to anon, authenticated using (false) with check (false);
comment on table public.profile_preferences is 'Private account preferences. Server routes derive the owner from verified Clerk-to-profile mapping; never accept a wallet ID from the request body.';
