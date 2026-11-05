-- Migration 0034 — per-role sidebar layout ("งานของฉัน" / "อื่นๆ"). Run AFTER 0023 (roles table).
--
-- View only: roles.menu_main is the ordered list of main-menu links shown on top of the
-- sidebar for that role; the other main-menu links fold under "อื่นๆ". '/admin' in the
-- list opens the Admin group by default. null = the original sidebar.
-- It never grants anything: a link still shows only when the role holds its permission
-- (role_permissions / has_permission are untouched). Admins edit it in Admin → Roles;
-- the existing roles_modify policy (users:manage) already covers the update.

alter table public.roles add column if not exists menu_main text[];

-- Starting layout for the 4 built-in roles (only where nothing was set yet).
update public.roles set menu_main = case id
  when 'admin'    then array['/dashboard', '/assets', '/config/alarms', '/admin']
  when 'engineer' then array['/data-entry', '/dashboard', '/assets', '/config/alarms']
  when 'manager'  then array['/reports', '/dashboard']
  when 'viewer'   then array['/dashboard', '/standards']
end
where id in ('admin', 'engineer', 'manager', 'viewer') and menu_main is null;
