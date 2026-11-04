-- Migration 0033 — latest oil reading per machine, for the Asset DB data checks. Run AFTER 0032.
--
-- The Asset DB page used to read every oil reading of every machine on each load,
-- just to find each machine's latest viscosity (lib/queries/asset-issues.ts), so it
-- got slower every month. This view returns one row per machine. The
-- unique (asset_id, period) index from 0001 serves the DISTINCT ON.
-- security_invoker: the caller's RLS on oil_readings applies, like a direct select.

create or replace view public.latest_oil_readings
with (security_invoker = true) as
  select distinct on (asset_id) asset_id, period, visc
  from public.oil_readings
  order by asset_id, period desc;

revoke all on public.latest_oil_readings from public, anon;
grant select on public.latest_oil_readings to authenticated;
