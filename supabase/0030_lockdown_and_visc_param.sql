-- Migration 0030 — close holes found in the 2026-10-28 audit. Run AFTER 0029.
--
-- 1. Functions are executable by PUBLIC by default, and these are SECURITY
--    DEFINER: with only the public anon key anyone could make the database
--    recompute every asset on demand. The app calls compute_health / recompute_all_health only through
--    the service-role client (lib/actions/alarms.ts); the reading triggers run
--    as the function owner, so they keep working.
-- 2. Viscosity is scored by each asset's ISO VG grade (0027), but compute_health
--    only scores parameters that have an alarm_params row, and no migration
--    ever added 'visc' — so viscosity never deducted in Supabase while Demo /
--    Local Store (lib/demo-data.ts) did. The limits here only apply to an asset
--    with no VG grade (same as lib/scoring/audit.ts).
-- 3. Config tables were readable without logging in (using (true)), which
--    exposed e.g. the report e-mail recipients to anyone with the anon key.

-- 1 -------------------------------------------------------------------------
revoke execute on function public.recompute_all_health() from public, anon, authenticated;
revoke execute on function public.compute_health(text) from public, anon, authenticated;
grant execute on function public.recompute_all_health() to service_role;
grant execute on function public.compute_health(text) to service_role;

-- 2 -------------------------------------------------------------------------
insert into public.alarm_params (category, key, name, unit, description, warn_limit, crit_limit, warn_penalty, crit_penalty) values
  ('oil', 'visc', 'Viscosity @40°C', 'cSt',
   'ความหนืดของน้ำมัน (ISO 3448:1992 ±5% Warning, ±10% Critical) — คำนวณจาก VG Grade ของอุปกรณ์',
   242, 264, 10, 25)
on conflict (category, key) do nothing;

-- 3 -------------------------------------------------------------------------
drop policy if exists "std_select" on public.standards;
create policy "std_select" on public.standards for select using (auth.role() = 'authenticated');
drop policy if exists "alarm_select" on public.alarm_params;
create policy "alarm_select" on public.alarm_params for select using (auth.role() = 'authenticated');
drop policy if exists "scorecfg_select" on public.score_config;
create policy "scorecfg_select" on public.score_config for select using (auth.role() = 'authenticated');
drop policy if exists "notif_read" on public.notification_config;
create policy "notif_read" on public.notification_config for select using (auth.role() = 'authenticated');
drop policy if exists "sites_select" on public.sites;
create policy "sites_select" on public.sites for select using (auth.role() = 'authenticated');
drop policy if exists "asset_types_select" on public.asset_types;
create policy "asset_types_select" on public.asset_types for select using (auth.role() = 'authenticated');

-- The new visc row changes scores for assets with out-of-range viscosity.
select public.recompute_all_health();
