-- =============================================================================
-- Migration 0023 — Dynamic RBAC (roles + permissions replace the 4 hardcoded roles)
-- =============================================================================
-- Before: `profiles.role` had an inline check constraint locked to exactly
-- ('admin','engineer','manager','viewer'), and ~60 RLS policy clauses across
-- 10 migrations plus 41 TypeScript `requireRole([...])` call sites each
-- independently hardcoded which of those 4 role names could do what. Adding a
-- 5th role meant editing the DB constraint, every relevant RLS policy, and
-- every relevant TS guard by hand — four places kept in sync manually.
--
-- After: three new tables (`roles`, `permissions`, `role_permissions`) turn
-- "which role can do X" into DATA instead of code. A new `has_permission(key)`
-- Postgres function is the SINGLE source of truth — RLS policies call it, and
-- the TypeScript action guard (`requirePermission`) calls the identical
-- function via `supabase.rpc('has_permission', ...)`, so the DB layer and the
-- app layer can never drift out of sync again. An admin can now create a new
-- role and grant/revoke permissions entirely through the app — no code change,
-- no migration.
--
-- This migration is a MEANING-PRESERVING translation: every `current_user_role()
-- in (...)` / `= 'admin'` check below is replaced with the has_permission()
-- equivalent that grants access to EXACTLY the same 4 existing roles as before,
-- with one deliberate refinement: `assets_modify` (a single "for all" policy)
-- is split into insert/update/delete so a future custom role can be granted
-- assets:write without assets:delete (or vice versa) — the app-level guards
-- already made this distinction (createAsset/updateAsset use assets:write,
-- deleteAsset(s) use assets:delete, deleteAllAssets uses the stricter
-- assets:delete_all), the old unified RLS policy just couldn't express it.
-- =============================================================================

-- =============================================================================
-- 1. Schema: roles / permissions / role_permissions
-- =============================================================================
create table public.roles (
  id         text primary key,                 -- e.g. 'admin', or a custom slug like 'technician'
  label      text not null,                     -- display name shown in the admin UI
  is_system  boolean not null default false,    -- true for the 4 seeded roles — protected from deletion
  created_at timestamptz default now()
);

create table public.permissions (
  key      text primary key,   -- e.g. 'assets:write' — referenced directly by RLS policies + TS guards
  label    text not null,
  category text not null       -- grouping for the admin UI (e.g. 'เครื่องจักร', 'งบประมาณ')
);

create table public.role_permissions (
  role_id        text not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

-- =============================================================================
-- 2. Seed: the fixed permission catalog
-- =============================================================================
-- Every key here corresponds to an ACTUAL check somewhere in RLS or app code —
-- this table is a developer-maintained catalog (migration-only), not editable
-- via the app: adding a row here does nothing until code actually checks it.
insert into public.permissions (key, label, category) values
  ('system:bypass_site_access', 'ข้ามข้อจำกัดการเข้าถึงตาม Site', 'ระบบ'),
  ('users:manage',              'จัดการผู้ใช้ / Role / สิทธิ์',      'ระบบ'),
  ('sites:manage',              'จัดการโรงงาน / ประเภทเครื่องจักร',  'ระบบ'),
  ('notifications:manage',      'ตั้งค่าการแจ้งเตือนอีเมล',          'ระบบ'),
  ('audit:read',                'ดู Audit Trail',                    'ระบบ'),
  ('assets:write',               'สร้าง / แก้ไขเครื่องจักร',          'เครื่องจักร'),
  ('assets:delete',              'ลบเครื่องจักร',                     'เครื่องจักร'),
  ('assets:delete_all',          'ลบเครื่องจักรทั้งหมด',              'เครื่องจักร'),
  ('assets:import',              'นำเข้าเครื่องจักรแบบชุด',           'เครื่องจักร'),
  ('alarms:write',               'ตั้งค่าเกณฑ์แจ้งเตือน / คะแนน',     'เครื่องจักร'),
  ('readings:write',             'บันทึกผลตรวจน้ำมัน / สั่นสะเทือน',  'เครื่องจักร'),
  ('maintenance:write',          'บันทึกประวัติซ่อมบำรุง',            'เครื่องจักร'),
  ('attachments:write',          'แนบ / ลบไฟล์แนบ',                   'ไฟล์แนบ'),
  ('attachments:read',           'ดาวน์โหลดไฟล์แนบ',                  'ไฟล์แนบ'),
  ('pm:write',                   'สร้าง / แก้ไข / ลบ PM Task',        'PM'),
  ('alerts:manage',              'รับทราบ / จัดการการแจ้งเตือน',      'PM'),
  ('workorders:write',           'สร้าง / แก้ไข / ลบ Work Order',     'Work Orders'),
  ('standards:write',            'สร้าง / แก้ไข / ลบมาตรฐาน',         'มาตรฐาน'),
  ('budget:write',               'บันทึกรายจ่าย / งบประมาณ',          'งบประมาณ'),
  ('budget:read',                'ดูงบประมาณ',                        'งบประมาณ'),
  ('reports:send_email',         'ส่งรายงานทางอีเมล',                 'รายงาน'),
  ('reports:read_all',           'ดูรายงานของทุกคน',                  'รายงาน')
on conflict (key) do nothing;

-- =============================================================================
-- 3. Seed: the 4 existing roles, marked as system roles (protected from deletion)
-- =============================================================================
insert into public.roles (id, label, is_system) values
  ('admin',    'ผู้ดูแลระบบ (Admin)',    true),
  ('engineer', 'วิศวกร (Engineer)',      true),
  ('manager',  'ผู้จัดการ (Manager)',    true),
  ('viewer',   'ผู้ดูข้อมูล (Viewer)',   true)
on conflict (id) do nothing;

-- =============================================================================
-- 4. Seed: role_permissions — reproduces EXACTLY what each role could already
--    do before this migration (verified against every current_user_role()
--    check being replaced below).
-- =============================================================================
insert into public.role_permissions (role_id, permission_key)
select 'admin', key from public.permissions
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select 'engineer', k from unnest(array[
  'assets:write','assets:delete','assets:import',
  'alarms:write','readings:write','maintenance:write',
  'attachments:write','attachments:read',
  'pm:write','alerts:manage','workorders:write','standards:write',
  'reports:send_email','sites:manage','notifications:manage',
  'budget:read','audit:read'
]) as k
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select 'manager', k from unnest(array[
  'attachments:read','maintenance:write','budget:write','budget:read','audit:read'
]) as k
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select 'viewer', k from unnest(array[
  'attachments:read','budget:read'
]) as k
on conflict do nothing;

-- =============================================================================
-- 5. profiles.role: drop the 4-value check constraint, add FK to roles(id)
-- =============================================================================
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_fkey foreign key (role) references public.roles(id);

-- =============================================================================
-- 6. has_permission() — the single source of truth, called from RLS AND from
--    the TS action guard (requirePermission -> supabase.rpc('has_permission')).
-- =============================================================================
create or replace function public.has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.role_permissions rp
    join public.profiles p on p.role = rp.role_id
    where p.id = auth.uid() and rp.permission_key = perm
  );
$$;

-- can_access_site's admin bypass is now data-driven: any role granted
-- system:bypass_site_access (only 'admin' by default) ignores site_access.
create or replace function public.can_access_site(p_site text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_permission('system:bypass_site_access')
    or public.current_user_sites() = '{}'
    or p_site = any(public.current_user_sites());
$$;

-- =============================================================================
-- 7. RLS: roles / permissions / role_permissions
-- =============================================================================
alter table public.roles           enable row level security;
alter table public.permissions     enable row level security;
alter table public.role_permissions enable row level security;

-- Roles + the permission catalog are readable by anyone signed in (the admin
-- UI's role picker and the Users page both need the role list; has_permission()
-- itself runs security definer so it never depends on these read policies).
create policy "roles_select" on public.roles for select using (auth.role() = 'authenticated');
create policy "roles_modify" on public.roles
  for all using (public.has_permission('users:manage'))
  with check (public.has_permission('users:manage'));

-- The permission catalog is migration-managed, not app-editable — select only.
create policy "permissions_select" on public.permissions for select using (auth.role() = 'authenticated');

create policy "role_permissions_select" on public.role_permissions for select using (auth.role() = 'authenticated');
create policy "role_permissions_modify" on public.role_permissions
  for all using (public.has_permission('users:manage'))
  with check (public.has_permission('users:manage'));

-- Belt-and-suspenders: block deleting a system role even for someone with
-- users:manage — a FK from profiles.role already blocks it while any user
-- still holds the role, but this also blocks deleting an unused system role.
create or replace function public.prevent_system_role_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_system then
    raise exception 'ไม่สามารถลบ role ระบบ (%): %', old.id, old.label;
  end if;
  return old;
end;
$$;
drop trigger if exists trg_prevent_system_role_delete on public.roles;
create trigger trg_prevent_system_role_delete
  before delete on public.roles
  for each row execute function public.prevent_system_role_delete();

-- =============================================================================
-- 8. Rewrite every existing current_user_role() RLS check as has_permission()
-- =============================================================================

-- ---- profiles (0001_schema.sql, superseded for update by 0011) ----
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select using (id = auth.uid() or public.has_permission('users:manage'));

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert" on public.profiles
  for insert with check (public.has_permission('users:manage'));

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (
    id = auth.uid()
    or public.has_permission('users:manage')
  )
  with check (
    public.has_permission('users:manage')
    or (
      id = auth.uid()
      and role = (select role from public.profiles where id = auth.uid())
      and site_access = (select site_access from public.profiles where id = auth.uid())
    )
  );

-- ---- assets: split "for all" into insert/update/delete so a custom role can
-- get assets:write without assets:delete (or vice versa) ----
drop policy if exists "assets_modify" on public.assets;
create policy "assets_insert" on public.assets
  for insert with check (public.can_access_site(site) and public.has_permission('assets:write'));
create policy "assets_update" on public.assets
  for update
  using (public.can_access_site(site) and public.has_permission('assets:write'))
  with check (public.can_access_site(site) and public.has_permission('assets:write'));
create policy "assets_delete" on public.assets
  for delete using (public.can_access_site(site) and public.has_permission('assets:delete'));

-- ---- oil / vib readings ----
drop policy if exists "oil_modify" on public.oil_readings;
create policy "oil_modify" on public.oil_readings
  for all using (public.has_permission('readings:write') and exists (
    select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)));

drop policy if exists "vib_modify" on public.vib_readings;
create policy "vib_modify" on public.vib_readings
  for all using (public.has_permission('readings:write') and exists (
    select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)));

-- ---- maintenance records ----
drop policy if exists "maint_modify" on public.maintenance_records;
create policy "maint_modify" on public.maintenance_records
  for all using (public.has_permission('maintenance:write') and exists (
    select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)));

-- ---- PM tasks / work orders / alerts ----
drop policy if exists "pm_modify" on public.pm_tasks;
create policy "pm_modify" on public.pm_tasks
  for all using (public.can_access_site(plant) and public.has_permission('pm:write'));

drop policy if exists "wo_modify" on public.work_orders;
create policy "wo_modify" on public.work_orders
  for all using (public.can_access_site(plant) and public.has_permission('workorders:write'));

drop policy if exists "alerts_modify" on public.alerts;
create policy "alerts_modify" on public.alerts
  for all using (public.can_access_site(plant) and public.has_permission('alerts:manage'));

-- ---- standards / alarm_params / score_config (globally readable config) ----
drop policy if exists "std_modify" on public.standards;
create policy "std_modify" on public.standards
  for all using (public.has_permission('standards:write'));

drop policy if exists "alarm_modify" on public.alarm_params;
create policy "alarm_modify" on public.alarm_params
  for all using (public.has_permission('alarms:write'));

drop policy if exists "scorecfg_modify" on public.score_config;
create policy "scorecfg_modify" on public.score_config
  for all using (public.has_permission('alarms:write'));

-- ---- budget ----
drop policy if exists "budget_read" on public.expenses;
create policy "budget_read" on public.expenses for select using (public.has_permission('budget:read'));
drop policy if exists "budget_modify" on public.expenses;
create policy "budget_modify" on public.expenses for all using (public.has_permission('budget:write'));

drop policy if exists "aproj_read" on public.annual_projects;
create policy "aproj_read" on public.annual_projects for select using (public.has_permission('budget:read'));
drop policy if exists "aproj_modify" on public.annual_projects;
create policy "aproj_modify" on public.annual_projects for all using (public.has_permission('budget:write'));

drop policy if exists "mcaps_read" on public.monthly_caps;
create policy "mcaps_read" on public.monthly_caps for select using (public.has_permission('budget:read'));
drop policy if exists "mcaps_modify" on public.monthly_caps;
create policy "mcaps_modify" on public.monthly_caps for all using (public.has_permission('budget:write'));

drop policy if exists "bcfg_read" on public.budget_config;
create policy "bcfg_read" on public.budget_config for select using (public.has_permission('budget:read'));
drop policy if exists "bcfg_modify" on public.budget_config;
create policy "bcfg_modify" on public.budget_config for all using (public.has_permission('budget:write'));

-- ---- reports (table is currently unused by the app, kept faithful anyway) ----
drop policy if exists "reports_select" on public.reports;
create policy "reports_select" on public.reports
  for select using (created_by = auth.uid() or public.has_permission('reports:read_all'));

-- ---- reading_attachments (metadata table; storage.objects handled below) ----
drop policy if exists "ra_modify" on public.reading_attachments;
create policy "ra_modify" on public.reading_attachments
  for all using (
    public.has_permission('attachments:write')
    and exists (select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site))
  );

-- ---- standard_attachments ----
drop policy if exists "sa_modify" on public.standard_attachments;
create policy "sa_modify" on public.standard_attachments
  for all using (public.has_permission('attachments:write'))
  with check (public.has_permission('attachments:write'));

-- ---- storage.objects: lab-attachments / standard-attachments / wo-attachments
-- (current, authoritative versions per 0021 for lab/wo, 0014 for standard) ----
drop policy if exists "lab_att_insert" on storage.objects;
create policy "lab_att_insert" on storage.objects
  for insert with check (
    bucket_id = 'lab-attachments'
    and public.has_permission('attachments:write')
    and exists (select 1 from public.assets a where a.id = (storage.foldername(name))[1] and public.can_access_site(a.site))
  );
drop policy if exists "lab_att_update" on storage.objects;
create policy "lab_att_update" on storage.objects
  for update using (
    bucket_id = 'lab-attachments'
    and public.has_permission('attachments:write')
    and exists (select 1 from public.assets a where a.id = (storage.foldername(name))[1] and public.can_access_site(a.site))
  );
drop policy if exists "lab_att_delete" on storage.objects;
create policy "lab_att_delete" on storage.objects
  for delete using (
    bucket_id = 'lab-attachments'
    and public.has_permission('attachments:write')
    and exists (select 1 from public.assets a where a.id = (storage.foldername(name))[1] and public.can_access_site(a.site))
  );

drop policy if exists "std_att_insert" on storage.objects;
create policy "std_att_insert" on storage.objects
  for insert with check (bucket_id = 'standard-attachments' and public.has_permission('attachments:write'));
drop policy if exists "std_att_update" on storage.objects;
create policy "std_att_update" on storage.objects
  for update using (bucket_id = 'standard-attachments' and public.has_permission('attachments:write'));
drop policy if exists "std_att_delete" on storage.objects;
create policy "std_att_delete" on storage.objects
  for delete using (bucket_id = 'standard-attachments' and public.has_permission('attachments:write'));

drop policy if exists "wo_att_insert" on storage.objects;
create policy "wo_att_insert" on storage.objects
  for insert with check (
    bucket_id = 'wo-attachments'
    and public.has_permission('attachments:write')
    and exists (select 1 from public.work_orders w where w.id = (storage.foldername(name))[1] and public.can_access_site(w.plant))
  );
drop policy if exists "wo_att_update" on storage.objects;
create policy "wo_att_update" on storage.objects
  for update using (
    bucket_id = 'wo-attachments'
    and public.has_permission('attachments:write')
    and exists (select 1 from public.work_orders w where w.id = (storage.foldername(name))[1] and public.can_access_site(w.plant))
  );
drop policy if exists "wo_att_delete" on storage.objects;
create policy "wo_att_delete" on storage.objects
  for delete using (
    bucket_id = 'wo-attachments'
    and public.has_permission('attachments:write')
    and exists (select 1 from public.work_orders w where w.id = (storage.foldername(name))[1] and public.can_access_site(w.plant))
  );

-- ---- notification_config ----
drop policy if exists "notif_modify" on public.notification_config;
create policy "notif_modify" on public.notification_config
  for all using (public.has_permission('notifications:manage'));

-- ---- audit_log ----
drop policy if exists "audit_read" on public.audit_log;
create policy "audit_read" on public.audit_log for select using (public.has_permission('audit:read'));

-- ---- sites / asset_types ----
drop policy if exists "sites_modify" on public.sites;
create policy "sites_modify" on public.sites for all using (public.has_permission('sites:manage'));

drop policy if exists "asset_types_modify" on public.asset_types;
create policy "asset_types_modify" on public.asset_types for all using (public.has_permission('sites:manage'));

-- ---- asset_alarm_overrides / asset_score_overrides ----
drop policy if exists "asset_alarm_ov_modify" on public.asset_alarm_overrides;
create policy "asset_alarm_ov_modify" on public.asset_alarm_overrides
  for all using (public.has_permission('alarms:write') and exists (
    select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)))
  with check (public.has_permission('alarms:write') and exists (
    select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)));

drop policy if exists "asset_score_ov_modify" on public.asset_score_overrides;
create policy "asset_score_ov_modify" on public.asset_score_overrides
  for all using (public.has_permission('alarms:write') and exists (
    select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)))
  with check (public.has_permission('alarms:write') and exists (
    select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site)));
