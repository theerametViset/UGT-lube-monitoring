-- Migration 0027 — score viscosity against each asset's ISO VG grade.
-- Run AFTER 0026.
--
-- The app has always judged viscosity by the asset's VG grade (ISO 3448:
-- Warning outside ±5%, Critical outside ±10%, too high OR too low), but
-- compute_health() compared it to the single fleet-wide alarm_params limits
-- (242 / 264, upper side only). Every asset with a VG grade other than ~220,
-- or with thin oil, got a different cached health in the DB than the
-- breakdown on its own Drill-down page. This brings compute_health() in line
-- with lib/scoring/audit.ts. alarm_params.warn_limit / crit_limit for 'visc'
-- are no longer used whenever the asset has a VG grade; its penalties still are.

-- Step penalty for a two-sided band: inside [lo_warn, hi_warn] = 0,
-- beyond a warn edge = warn penalty, beyond a crit edge = crit penalty.
create or replace function public.health_penalty_band(
  p_val numeric,
  p_lo_crit numeric, p_lo_warn numeric, p_hi_warn numeric, p_hi_crit numeric,
  p_warn_pen numeric, p_crit_pen numeric
) returns numeric
language sql immutable as $$
  select case
    when p_val is null then 0
    when p_val > p_hi_crit or p_val < p_lo_crit then p_crit_pen
    when p_val > p_hi_warn or p_val < p_lo_warn then p_warn_pen
    else 0
  end;
$$;

-- Same as 0020's compute_health, plus the viscosity branch in the oil loop.
create or replace function public.compute_health(p_asset_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg record; v_score_ov record; v_oil numeric := 100; v_vib numeric := 100; v_net numeric;
  has_oil boolean := false; has_vib boolean := false;
  latest_oil record; latest_vib record; par record; ov record; v numeric;
  w_pen numeric; c_pen numeric; warn_lim numeric; crit_lim numeric;
  oil_weight numeric; vib_weight numeric; d_warn_pen numeric; d_crit_pen numeric;
  v_vg numeric;
begin
  select * into v_cfg from public.score_config where id = 1;
  if not found then return; end if;
  select * into v_score_ov from public.asset_score_overrides where asset_id = p_asset_id;
  select vg_grade into v_vg from public.assets where id = p_asset_id;

  oil_weight := coalesce(v_score_ov.oil_weight, v_cfg.oil_weight);
  vib_weight := coalesce(v_score_ov.vib_weight, v_cfg.vib_weight);
  d_warn_pen := coalesce(v_score_ov.warn_penalty, v_cfg.warn_penalty);
  d_crit_pen := coalesce(v_score_ov.crit_penalty, v_cfg.crit_penalty);

  select * into latest_oil from public.oil_readings
    where asset_id = p_asset_id order by period desc, created_at desc limit 1;
  has_oil := found;
  if has_oil then
    for par in select * from public.alarm_params where category = 'oil' loop
      select * into ov from public.asset_alarm_overrides
        where asset_id = p_asset_id and category = 'oil' and key = par.key;
      v := nullif(to_jsonb(latest_oil) ->> par.key, '')::numeric;
      w_pen := coalesce(ov.warn_penalty, par.warn_penalty, d_warn_pen);
      c_pen := coalesce(ov.crit_penalty, par.crit_penalty, d_crit_pen);
      if par.key = 'visc' and v_vg > 0 then
        -- Rounded to 2 decimals exactly like lib/viscosity-limits.ts.
        v_oil := v_oil - coalesce(public.health_penalty_band(v,
          round(v_vg * 0.90, 2), round(v_vg * 0.95, 2),
          round(v_vg * 1.05, 2), round(v_vg * 1.10, 2),
          w_pen, c_pen), 0);
      else
        warn_lim := coalesce(ov.warn_limit, par.warn_limit);
        crit_lim := coalesce(ov.crit_limit, par.crit_limit);
        v_oil := v_oil - coalesce(public.health_penalty(v, warn_lim, crit_lim, w_pen, c_pen), 0);
      end if;
    end loop;
    v_oil := greatest(0, v_oil);
  end if;
  select * into latest_vib from public.vib_readings
    where asset_id = p_asset_id order by period desc, created_at desc limit 1;
  has_vib := found;
  if has_vib then
    for par in select * from public.alarm_params where category = 'vib' loop
      select * into ov from public.asset_alarm_overrides
        where asset_id = p_asset_id and category = 'vib' and key = par.key;
      v := nullif(to_jsonb(latest_vib) ->> par.key, '')::numeric;
      warn_lim := coalesce(ov.warn_limit, par.warn_limit);
      crit_lim := coalesce(ov.crit_limit, par.crit_limit);
      w_pen := coalesce(ov.warn_penalty, par.warn_penalty, d_warn_pen);
      c_pen := coalesce(ov.crit_penalty, par.crit_penalty, d_crit_pen);
      v_vib := v_vib - coalesce(public.health_penalty(v, warn_lim, crit_lim, w_pen, c_pen), 0);
    end loop;
    v_vib := greatest(0, v_vib);
  end if;
  if has_oil and has_vib then
    v_net := v_oil * (oil_weight / 100.0) + v_vib * (vib_weight / 100.0);
  elsif has_oil then v_net := v_oil;
  elsif has_vib then v_net := v_vib;
  else v_net := 100; end if;
  v_net := greatest(0, least(100, round(v_net)));
  update public.assets set
    health = v_net::int,
    status = case when v_net < 40 then 'Critical' when v_net < 80 then 'Warning' else 'Healthy' end
  where id = p_asset_id;
end;
$$;

select public.recompute_all_health();
