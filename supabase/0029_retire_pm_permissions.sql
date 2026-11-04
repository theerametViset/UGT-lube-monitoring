-- Migration 0029 — retire the permissions of the removed PM / Work Order /
-- Budget / EAM / AI Reliability / AI Chat modules. Run AFTER 0028.
--
-- The app no longer has these modules (spec:
-- docs/superpowers/specs/2026-10-28-remove-pm-modules-design.md). Their tables
-- (pm_tasks, work_orders, alerts, wo_attachments, expenses, annual_projects,
-- monthly_caps, budget_config) are KEPT with their data, but the RLS policies
-- from 0023 still grant writes to any role holding these keys — reachable
-- straight through PostgREST with a user JWT. Deleting the keys removes every
-- grant (role_permissions cascades), so has_permission() is false for all
-- roles and the write / budget-read policies on those tables admit no one.
--
-- To restore: re-insert the rows from 0023_dynamic_rbac.sql.

delete from public.permissions
where key in (
  'pm:read', 'pm:write', 'alerts:manage',
  'workorders:read', 'workorders:write',
  'budget:read', 'budget:write',
  'eam:read', 'reliability:read', 'aichat:read'
);
