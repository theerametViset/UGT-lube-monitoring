-- 0017_sites_asset_types_rls.sql
-- Security fix: sites and asset_types were created in 0001_schema.sql but
-- never had RLS enabled (unlike every other table). Mirrors the existing
-- "globally readable config; engineers+ write" pattern already used for
-- standards/alarm_params/score_config.
alter table public.sites       enable row level security;
alter table public.asset_types enable row level security;

create policy "sites_select" on public.sites for select using (true);
create policy "sites_modify" on public.sites
  for all using (public.current_user_role() in ('admin','engineer'));

create policy "asset_types_select" on public.asset_types for select using (true);
create policy "asset_types_modify" on public.asset_types
  for all using (public.current_user_role() in ('admin','engineer'));
