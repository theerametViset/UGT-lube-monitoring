-- Migration 0008 — per-parameter penalty (each param has own warn/crit penalty)
-- Run AFTER 0007. Adds warn_penalty/crit_penalty to alarm_params + recreates compute_health.

alter table public.alarm_params
  add column if not exists warn_penalty numeric,
  add column if not exists crit_penalty numeric;

update public.alarm_params set warn_penalty=20, crit_penalty=40 where key='fe';
update public.alarm_params set warn_penalty=15, crit_penalty=30 where key='cu';
update public.alarm_params set warn_penalty=10, crit_penalty=25 where key='si';
update public.alarm_params set warn_penalty=15, crit_penalty=35 where key='water';
update public.alarm_params set warn_penalty=10, crit_penalty=25 where key='tan';
update public.alarm_params set warn_penalty=20, crit_penalty=40 where key='vel';
update public.alarm_params set warn_penalty=15, crit_penalty=30 where key='acc';

create or replace function public.compute_health(p_asset_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg record; v_oil numeric := 100; v_vib numeric := 100; v_net numeric;
  has_oil boolean := false; has_vib boolean := false;
  latest_oil record; latest_vib record; par record; v numeric;
  w_pen numeric; c_pen numeric;
begin
  select * into v_cfg from public.score_config where id = 1;
  if not found then return; end if;
  select * into latest_oil from public.oil_readings
    where asset_id = p_asset_id order by period desc, created_at desc limit 1;
  has_oil := found;
  if has_oil then
    for par in select * from public.alarm_params where category = 'oil' loop
      v := nullif(to_jsonb(latest_oil) ->> par.key, '')::numeric;
      w_pen := coalesce(par.warn_penalty, v_cfg.warn_penalty);
      c_pen := coalesce(par.crit_penalty, v_cfg.crit_penalty);
      v_oil := v_oil - coalesce(public.health_penalty(v, par.warn_limit, par.crit_limit, w_pen, c_pen), 0);
    end loop;
    v_oil := greatest(0, v_oil);
  end if;
  select * into latest_vib from public.vib_readings
    where asset_id = p_asset_id order by period desc, created_at desc limit 1;
  has_vib := found;
  if has_vib then
    for par in select * from public.alarm_params where category = 'vib' loop
      v := nullif(to_jsonb(latest_vib) ->> par.key, '')::numeric;
      w_pen := coalesce(par.warn_penalty, v_cfg.warn_penalty);
      c_pen := coalesce(par.crit_penalty, v_cfg.crit_penalty);
      v_vib := v_vib - coalesce(public.health_penalty(v, par.warn_limit, par.crit_limit, w_pen, c_pen), 0);
    end loop;
    v_vib := greatest(0, v_vib);
  end if;
  if has_oil and has_vib then
    v_net := v_oil * (v_cfg.oil_weight / 100.0) + v_vib * (v_cfg.vib_weight / 100.0);
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
