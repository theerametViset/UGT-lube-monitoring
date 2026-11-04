-- =============================================================================
-- Module "view" permissions — before this, every menu/page (Assets, PM,
-- Work Orders, Budget, Standards, Alarm Config, Reports, EAM, AI Reliability,
-- AI Chat, Data Entry) was visible to any authenticated role; only WRITE
-- actions inside them were permission-gated. This adds a separate :read (or
-- reports:view, to avoid colliding with the existing reports:read_all "see
-- everyone's reports" permission) for each module, so an admin can hide a
-- whole module from a custom role via /admin/roles — e.g. a role with no
-- pm:read no longer sees or can open any PM page.
--
-- All 4 built-in roles are granted every one of these below, so existing
-- accounts see exactly what they saw before this migration. The restriction
-- only takes effect when an admin creates/edits a role and unchecks one.
-- =============================================================================
insert into public.permissions (key, label, category) values
  ('assets:read',       'มองเห็นเมนู ฐานข้อมูลเครื่องจักร',                 'เครื่องจักร'),
  ('alarms:read',       'มองเห็นเมนู ตั้งค่าแจ้งเตือน',                     'เครื่องจักร'),
  ('dataentry:read',    'มองเห็นเมนู ป้อนข้อมูล',                           'ป้อนข้อมูล'),
  ('pm:read',           'มองเห็นเมนู PM (Compliance/Calendar/Setup/Alerts)', 'PM'),
  ('workorders:read',   'มองเห็นเมนู Work Orders',                          'Work Orders'),
  ('standards:read',    'มองเห็นเมนู คลังมาตรฐาน',                          'มาตรฐาน'),
  ('reports:view',      'มองเห็นเมนู รายงานผู้บริหาร',                      'รายงาน'),
  ('eam:read',          'มองเห็นเมนู EAM Reporting',                        'AI & EAM'),
  ('reliability:read',  'มองเห็นเมนู AI Reliability Center',                'AI & EAM'),
  ('aichat:read',       'มองเห็นเมนู AI ผู้ช่วยสอบถาม',                     'AI & EAM')
on conflict (key) do nothing;

-- budget:read already existed (seeded in 0023) and is reused as the Budget
-- page's view permission — no new row needed for it.

insert into public.role_permissions (role_id, permission_key)
select r, k
from unnest(array['admin', 'engineer', 'manager', 'viewer']) as r
cross join unnest(array[
  'assets:read', 'dataentry:read', 'standards:read', 'alarms:read', 'reports:view',
  'pm:read', 'workorders:read', 'eam:read', 'reliability:read', 'aichat:read'
]) as k
on conflict do nothing;
