-- Migration 0036 — permission to edit the narrative text of a report. Run AFTER 0023.
--
-- Reports (หน้า "รายงานผู้บริหาร") let a user reword the summary and recommendations before
-- printing or emailing. Numbers, the verdict and the tables stay locked. Granted to admin and
-- engineer, like reports:send_email; other roles get it from Admin → Roles.

insert into public.permissions (key, label, category) values
  ('reports:edit', 'แก้ไขข้อความในรายงาน', 'รายงาน')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r, 'reports:edit' from unnest(array['admin', 'engineer']) as r
on conflict do nothing;
