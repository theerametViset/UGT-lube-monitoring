-- Migration 0035 — recompute a machine's Health Score when one of its readings is deleted. Run AFTER 0001.
--
-- The 0001 triggers ran after insert or update only, so deleting a reading (Drill-down's
-- "ลบผลงวดนี้") left assets.health / status at the deleted reading's score. Same functions,
-- now taking the asset from OLD on a delete. compute_health then scores the latest reading
-- that is left (or 100 when none is).

create or replace function public.tg_recompute_oil()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.compute_health(coalesce(new.asset_id, old.asset_id)); return null; end;
$$;
drop trigger if exists oil_readings_recompute on public.oil_readings;
create trigger oil_readings_recompute
  after insert or update or delete on public.oil_readings
  for each row execute function public.tg_recompute_oil();

create or replace function public.tg_recompute_vib()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.compute_health(coalesce(new.asset_id, old.asset_id)); return null; end;
$$;
drop trigger if exists vib_readings_recompute on public.vib_readings;
create trigger vib_readings_recompute
  after insert or update or delete on public.vib_readings
  for each row execute function public.tg_recompute_vib();
