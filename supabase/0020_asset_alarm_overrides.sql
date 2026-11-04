-- Migration 0020 — per-asset alarm/scoring overrides.
-- Adds an asset-level override tier ON TOP OF the existing global alarm_params /
-- score_config (0001, 0008). Same coalesce-fallback pattern already used for
-- per-param penalties, extended one level further:
--   asset_alarm_overrides (per param, per asset) -> alarm_params (global per param)
--   asset_score_overrides (per asset)            -> score_config (global default)
-- Run AFTER 0008.

create table if not exists public.asset_alarm_overrides (
  id           uuid primary key default gen_random_uuid(),
  asset_id     text not null references public.assets(id) on delete cascade,
  category     text not null check (category in ('oil','vib')),
  key          text not null,
  warn_limit   numeric,
  crit_limit   numeric,
  warn_penalty numeric,
  crit_penalty numeric,
  unique (asset_id, category, key)
);
create index if not exists asset_alarm_overrides_asset_idx on public.asset_alarm_overrides (asset_id);

create table if not exists public.asset_score_overrides (
  asset_id     text primary key references public.assets(id) on delete cascade,
  oil_weight   numeric,
  vib_weight   numeric,
  warn_penalty numeric,
  crit_penalty numeric
);

alter table public.asset_alarm_overrides enable row level security;
alter table public.asset_score_overrides enable row level security;

create policy "asset_alarm_ov_select" on public.asset_alarm_overrides
  for select using (exists (select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)));
create policy "asset_alarm_ov_modify" on public.asset_alarm_overrides
  for all using (public.current_user_role() in ('admin','engineer') and exists (
    select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)))
  with check (public.current_user_role() in ('admin','engineer') and exists (
    select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)));

create policy "asset_score_ov_select" on public.asset_score_overrides
  for select using (exists (select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)));
create policy "asset_score_ov_modify" on public.asset_score_overrides
  for all using (public.current_user_role() in ('admin','engineer') and exists (
    select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)))
  with check (public.current_user_role() in ('admin','engineer') and exists (
    select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)));

-- Rewrite compute_health to cascade: asset-param-override -> global-param -> asset-score-override -> global-score-config.
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
begin
  select * into v_cfg from public.score_config where id = 1;
  if not found then return; end if;
  select * into v_score_ov from public.asset_score_overrides where asset_id = p_asset_id;

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
      warn_lim := coalesce(ov.warn_limit, par.warn_limit);
      crit_lim := coalesce(ov.crit_limit, par.crit_limit);
      w_pen := coalesce(ov.warn_penalty, par.warn_penalty, d_warn_pen);
      c_pen := coalesce(ov.crit_penalty, par.crit_penalty, d_crit_pen);
      v_oil := v_oil - coalesce(public.health_penalty(v, warn_lim, crit_lim, w_pen, c_pen), 0);
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
