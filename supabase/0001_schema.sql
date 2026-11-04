-- Function bodies are checked when they run, not when created: the helpers below
-- read public.profiles, which is created further down.
set check_function_bodies = off;

-- =============================================================================
-- UGT Reliability Lubrication AI Platform v3
-- Supabase / Postgres schema — single source of truth for data + security
-- Reference: PRD.md (sections 4, 5, 6)
-- Run order: 0001_schema.sql  ->  0002_seed.sql  ->  app connects via @supabase/ssr
-- =============================================================================

-- ---------- extensions ----------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "uuid-ossp";

-- =============================================================================
-- 0. RBAC helper functions (used by every RLS policy)
-- =============================================================================
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'viewer'
  );
$$;

create or replace function public.current_user_sites()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select site_access from public.profiles where id = auth.uid()),
    '{}'
  );
$$;

-- Does the current user have access to a given site?
create or replace function public.can_access_site(p_site text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_role() = 'admin'
    or public.current_user_sites() = '{}'
    or p_site = any(public.current_user_sites());
$$;

-- =============================================================================
-- 1. Reference data
-- =============================================================================
create table public.sites (
  code        text primary key,                 -- 'NY1'
  name        text not null,
  sort_order  int  default 0
);

create table public.asset_types (
  name  text primary key,                       -- 'Reciprocating Pump'
  abbr  text,                                   -- 'RE'
  color text                                    -- '#0ea5e9'
);

-- =============================================================================
-- 2. Auth / profiles
-- =============================================================================
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text,
  role        text not null default 'viewer'
              check (role in ('admin','engineer','manager','viewer')),
  site_access text[] default '{}',              -- '{}' = all sites
  created_at  timestamptz default now()
);

-- =============================================================================
-- 3. Assets (core entity)
-- =============================================================================
create table public.assets (
  id                 text primary key,          -- 'RE-1001'
  name               text not null,
  type               text not null references public.asset_types(name),
  site               text not null references public.sites(code),
  health             int  default 100,          -- derived cache (0-100)
  status             text default 'Healthy'
                     check (status in ('Healthy','Warning','Critical')),
  install_date       date default '2020-01-01',
  motor_kw           numeric,
  rpm                numeric,
  vg_grade           int default 46,            -- ISO VG
  oil_brand          text,
  oil_qty_l          numeric default 20,
  oil_change_months  int default 6,
  oil_sample_months  int default 3,
  last_update        text,                      -- 'YYYY-MM'
  created_at         timestamptz default now()
);
create index assets_site_idx   on public.assets (site);
create index assets_status_idx on public.assets (status);

-- =============================================================================
-- 4. Time-series readings
-- =============================================================================
create table public.oil_readings (
  id          uuid primary key default gen_random_uuid(),
  asset_id    text not null references public.assets(id) on delete cascade,
  period      text not null,                    -- 'YYYY-MM'
  fe numeric, cu numeric, si numeric,
  water numeric, visc numeric, tan numeric,
  iso_code text,                               -- '18/16/13'
  created_at  timestamptz default now(),
  unique (asset_id, period)
);
create index oil_readings_asset_period_idx on public.oil_readings (asset_id, period desc);

create table public.vib_readings (
  id          uuid primary key default gen_random_uuid(),
  asset_id    text not null references public.assets(id) on delete cascade,
  period      text not null,
  vel numeric, acc numeric, cf numeric, temp numeric,
  created_at  timestamptz default now(),
  unique (asset_id, period)
);
create index vib_readings_asset_period_idx on public.vib_readings (asset_id, period desc);

-- =============================================================================
-- 5. Maintenance history
-- =============================================================================
create table public.maintenance_records (
  id           uuid primary key default gen_random_uuid(),
  asset_id     text not null references public.assets(id) on delete cascade,
  type         text not null check (type in ('pm','cm')),
  work_date    date,
  wo_no        text,                           -- 'MNT-23871'
  description  text,
  parts        text,
  cost         numeric default 0,
  technician   text,
  created_at   timestamptz default now()
);
create index maint_asset_idx on public.maintenance_records (asset_id);

-- =============================================================================
-- 6. Alarm / threshold config (single source of truth for scoring)
-- =============================================================================
create table public.alarm_params (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('oil','vib')),
  key         text not null,                   -- 'fe','water','vel',...
  name        text not null,                   -- 'Iron (Fe)'
  unit        text,
  description text,
  warn_limit  numeric,
  crit_limit  numeric,
  unique (category, key)
);

create table public.score_config (
  id            int primary key default 1,
  oil_weight    numeric default 60,            -- %
  vib_weight    numeric default 40,            -- %
  warn_penalty  numeric default 15,            -- deduction at warn_limit
  crit_penalty  numeric default 30             -- deduction at crit_limit
);
insert into public.score_config (id) values (1) on conflict do nothing;

-- =============================================================================
-- 7. PM tasks / Work orders / Alerts  (Phase P1)
-- =============================================================================
create table public.pm_tasks (
  id            text primary key,              -- 'PM-001'
  name          text not null,
  frequency     text not null,                 -- Daily|...|Condition Based
  asset_id      text not null references public.assets(id),
  plant         text references public.sites(code),
  criticality   text check (criticality in ('High','Medium','Low')),
  freq_days     int,
  last_done     date,
  next_due      date,
  overdue_days  int default 0,
  est_duration  int default 60,                -- minutes
  skill         text, technician text, planner text,
  status        text default 'Scheduled'
                check (status in ('Scheduled','Due Soon','Overdue')),
  loto          boolean default false,
  permit        boolean default false,
  created_at    timestamptz default now()
);

create table public.work_orders (
  id             text primary key,             -- 'WO-50000'
  pm_id          text references public.pm_tasks(id),
  asset_id       text not null references public.assets(id),
  plant          text references public.sites(code),
  type           text not null check (type in ('PM','CM','EM','Inspection')),
  priority       text not null check (priority in ('Critical','High','Medium','Low')),
  status         text not null default 'Open'
                 check (status in ('Open','Assigned','InProgress','WaitingParts','Completed','Closed')),
  created_date   date, due_date date, completed_date date,
  technician     text, planner text,
  cost           numeric default 0,
  description    text,
  created_at     timestamptz default now()
);
create index wo_status_idx on public.work_orders (status);
create index wo_asset_idx  on public.work_orders (asset_id);

create table public.alerts (
  id                text primary key,          -- 'AL-1000'
  level             text not null check (level in ('Critical','High','Medium','Low','Information')),
  category          text not null,
  asset_id          text, asset_name text, plant text,
  message           text,
  status            text default 'Open'
                    check (status in ('Open','Acknowledged','Assigned','InProgress','Completed','Closed')),
  escalation_level  int default 0,             -- 0-4 (ISA-18.2 style)
  created_at        timestamptz default now()
);
create index alerts_status_idx on public.alerts (status);

-- =============================================================================
-- 8. Standards library
-- =============================================================================
create table public.standards (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('TRIBOLOGY','VIBRATION','RELIABILITY','ASSET','CUSTOM')),
  title       text not null,                   -- 'ISO 4406:2021'
  subtitle    text,
  description text,
  full_text   text,
  tags        text[],
  created_at  timestamptz default now()
);

-- =============================================================================
-- 9. Budget (Phase P2)
-- =============================================================================
create table public.budget_config (
  id           int primary key default 1,
  monthly_cap  numeric default 200000,
  ratio        numeric
);
insert into public.budget_config (id) values (1) on conflict do nothing;

create table public.monthly_caps (
  id      uuid primary key default gen_random_uuid(),
  year    int not null, month int not null check (month between 1 and 12),
  cap     numeric, actual numeric,
  unique (year, month)
);

create table public.expenses (
  id            text primary key,              -- 'EXP-...'
  expense_date  date not null,
  description   text not null,
  amount        numeric not null check (amount > 0),
  machine_type  text,
  category      text check (category in ('parts','repair')),
  project_id    text,
  pr_no text, po_no text, wo_no text, vendor text,
  created_at    timestamptz default now()
);

create table public.annual_projects (
  id           text primary key,               -- 'AP-2026-001'
  name         text not null,
  due_month    int not null,
  budget       numeric not null,
  equipment_id text references public.assets(id),
  status       text default 'วางแผน'
);
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  period      text,
  site        text,
  payload     jsonb,                           -- generated report content
  file_path   text,                            -- Supabase Storage path (PDF)
  created_by  uuid references public.profiles(id),
  created_at  timestamptz default now()
);

-- =============================================================================
-- 10. HEALTH SCORE ENGINE (single source of truth — PRD section 6)
-- =============================================================================

-- Piecewise penalty: 0 below warn, linear warn_penalty..crit_penalty between warn..crit,
-- capped at crit_penalty above crit.
create or replace function public.health_penalty(
  p_val numeric, p_warn numeric, p_crit numeric,
  p_warn_pen numeric, p_crit_pen numeric
) returns numeric
language sql immutable as $$
  select case
    when p_val is null then 0
    when p_val > p_crit then p_crit_pen
    when p_val > p_warn and p_crit > p_warn
      then p_warn_pen + (p_crit_pen - p_warn_pen) * (p_val - p_warn) / (p_crit - p_warn)
    else 0
  end;
$$;

-- Recompute one asset from its latest oil + vib readings using configured thresholds.
-- Updates assets.health + assets.status in place.
create or replace function public.compute_health(p_asset_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg        record;
  v_oil        numeric := 100;
  v_vib        numeric := 100;
  v_net        numeric;
  has_oil      boolean := false;
  has_vib      boolean := false;
  latest_oil   record;
  latest_vib   record;
  par          record;
  v            numeric;
begin
  select * into v_cfg from public.score_config where id = 1;
  if not found then return; end if;

  -- latest oil reading
  select * into latest_oil from public.oil_readings
    where asset_id = p_asset_id
    order by period desc, created_at desc limit 1;
  has_oil := found;

  if has_oil then
    for par in select * from public.alarm_params where category = 'oil' loop
      v := nullif(to_jsonb(latest_oil) ->> par.key, '')::numeric;
      v_oil := v_oil - coalesce(
        public.health_penalty(v, par.warn_limit, par.crit_limit,
                              v_cfg.warn_penalty, v_cfg.crit_penalty), 0);
    end loop;
    v_oil := greatest(0, v_oil);
  end if;

  -- latest vib reading
  select * into latest_vib from public.vib_readings
    where asset_id = p_asset_id
    order by period desc, created_at desc limit 1;
  has_vib := found;

  if has_vib then
    for par in select * from public.alarm_params where category = 'vib' loop
      v := nullif(to_jsonb(latest_vib) ->> par.key, '')::numeric;
      v_vib := v_vib - coalesce(
        public.health_penalty(v, par.warn_limit, par.crit_limit,
                              v_cfg.warn_penalty, v_cfg.crit_penalty), 0);
    end loop;
    v_vib := greatest(0, v_vib);
  end if;

  if has_oil and has_vib then
    v_net := v_oil * (v_cfg.oil_weight / 100.0) + v_vib * (v_cfg.vib_weight / 100.0);
  elsif has_oil then v_net := v_oil;
  elsif has_vib then v_net := v_vib;
  else                v_net := 100;
  end if;

  v_net := greatest(0, least(100, round(v_net)));

  update public.assets set
    health = v_net::int,
    status = case when v_net < 40 then 'Critical'
                  when v_net < 80 then 'Warning'
                  else 'Healthy' end
  where id = p_asset_id;
end;
$$;

-- Recompute every asset (call after changing thresholds / score_config).
create or replace function public.recompute_all_health()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare a text;
begin
  for a in select id from public.assets loop
    perform public.compute_health(a);
  end loop;
end;
$$;

-- Auto-recompute on new/changed readings
create or replace function public.tg_recompute_oil()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.compute_health(new.asset_id); return new; end;
$$;
create trigger oil_readings_recompute
  after insert or update on public.oil_readings
  for each row execute function public.tg_recompute_oil();

create or replace function public.tg_recompute_vib()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.compute_health(new.asset_id); return new; end;
$$;
create trigger vib_readings_recompute
  after insert or update on public.vib_readings
  for each row execute function public.tg_recompute_vib();

-- =============================================================================
-- 11. ROW LEVEL SECURITY
-- =============================================================================
alter table public.profiles            enable row level security;
alter table public.assets              enable row level security;
alter table public.oil_readings        enable row level security;
alter table public.vib_readings        enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.pm_tasks            enable row level security;
alter table public.work_orders         enable row level security;
alter table public.alerts              enable row level security;
alter table public.standards           enable row level security;
alter table public.alarm_params        enable row level security;
alter table public.score_config        enable row level security;
alter table public.expenses            enable row level security;
alter table public.annual_projects     enable row level security;
alter table public.monthly_caps        enable row level security;
alter table public.reports             enable row level security;
alter table public.budget_config       enable row level security;

-- ---- profiles: own row always; admins see all ----
create policy "profiles_self_select" on public.profiles
  for select using (id = auth.uid() or public.current_user_role() = 'admin');
create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid() or public.current_user_role() = 'admin');
create policy "profiles_admin_insert" on public.profiles
  for insert with check (public.current_user_role() = 'admin');

-- ---- generic site-scoped policy macro (applied per table) ----
-- read = admin OR site-access OR site_null
create policy "assets_select" on public.assets
  for select using (public.can_access_site(site));
create policy "assets_modify" on public.assets
  for all using (public.can_access_site(site) and public.current_user_role() in ('admin','engineer'))
  with check (public.can_access_site(site) and public.current_user_role() in ('admin','engineer'));

create policy "oil_select" on public.oil_readings
  for select using (exists (select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)));
create policy "oil_modify" on public.oil_readings
  for all using (public.current_user_role() in ('admin','engineer') and exists (
    select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)));

create policy "vib_select" on public.vib_readings
  for select using (exists (select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)));
create policy "vib_modify" on public.vib_readings
  for all using (public.current_user_role() in ('admin','engineer') and exists (
    select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)));

create policy "maint_select" on public.maintenance_records
  for select using (exists (select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)));
create policy "maint_modify" on public.maintenance_records
  for all using (public.current_user_role() in ('admin','engineer','manager') and exists (
    select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)));

create policy "pm_select" on public.pm_tasks
  for select using (public.can_access_site(plant));
create policy "pm_modify" on public.pm_tasks
  for all using (public.can_access_site(plant) and public.current_user_role() in ('admin','engineer'));

create policy "wo_select" on public.work_orders
  for select using (public.can_access_site(plant));
create policy "wo_modify" on public.work_orders
  for all using (public.can_access_site(plant) and public.current_user_role() in ('admin','engineer'));

create policy "alerts_select" on public.alerts
  for select using (public.can_access_site(plant));
create policy "alerts_modify" on public.alerts
  for all using (public.can_access_site(plant) and public.current_user_role() in ('admin','engineer'));

-- ---- globally readable config; engineers+ write ----
create policy "std_select" on public.standards for select using (true);
create policy "std_modify" on public.standards
  for all using (public.current_user_role() in ('admin','engineer'));

create policy "alarm_select" on public.alarm_params for select using (true);
create policy "alarm_modify" on public.alarm_params
  for all using (public.current_user_role() in ('admin','engineer'));

create policy "scorecfg_select" on public.score_config for select using (true);
create policy "scorecfg_modify" on public.score_config
  for all using (public.current_user_role() in ('admin','engineer'));

-- ---- budget: managers+ ----
create policy "budget_read" on public.expenses
  for select using (public.current_user_role() in ('admin','engineer','manager','viewer'));
create policy "budget_modify" on public.expenses
  for all using (public.current_user_role() in ('admin','manager'));
create policy "aproj_read" on public.annual_projects
  for select using (public.current_user_role() in ('admin','engineer','manager','viewer'));
create policy "aproj_modify" on public.annual_projects
  for all using (public.current_user_role() in ('admin','manager'));
create policy "mcaps_read" on public.monthly_caps
  for select using (public.current_user_role() in ('admin','engineer','manager','viewer'));
create policy "mcaps_modify" on public.monthly_caps
  for all using (public.current_user_role() in ('admin','manager'));
create policy "bcfg_read" on public.budget_config
  for select using (public.current_user_role() in ('admin','engineer','manager','viewer'));
create policy "bcfg_modify" on public.budget_config
  for all using (public.current_user_role() in ('admin','manager'));

-- ---- reports: owner or admin ----
create policy "reports_select" on public.reports
  for select using (created_by = auth.uid() or public.current_user_role() = 'admin');
create policy "reports_insert" on public.reports
  for insert with check (created_by = auth.uid());

-- =============================================================================
-- 12. auto-create profile on signup
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
