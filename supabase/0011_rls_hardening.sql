-- =============================================================================
-- UGT Reliability Lubrication AI Platform v3
-- Migration 0011 — RLS hardening (audit fixes AUD-001 / AUD-005)
-- Run AFTER 0010. Recreates policies that allowed privilege escalation and
-- un-scoped Storage access. Idempotent (drop if exists + recreate).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- AUD-001: profiles self-update must NOT allow role/site_access escalation
-- -----------------------------------------------------------------------------
-- Before: `for update using (id = auth.uid() or admin)` with NO `with check`,
-- so any authenticated user could update their own row and set role='admin'
-- with full site_access.
-- After: self-update is allowed only when the resulting row keeps role and
-- site_access identical to the CURRENT stored values (the subqueries read the
-- pre-update row). Admins may still update any row, including roles.
drop policy if exists "profiles_self_update" on public.profiles;

create policy "profiles_self_update" on public.profiles
  for update using (
    id = auth.uid()
    or public.current_user_role() = 'admin'
  )
  with check (
    public.current_user_role() = 'admin'
    or (
      id = auth.uid()
      and role = (select role from public.profiles where id = auth.uid())
      and site_access = (select site_access from public.profiles where id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- AUD-005: Storage bucket 'lab-attachments' must respect role + site scope
-- -----------------------------------------------------------------------------
-- Before: any authenticated user could read/insert/update/delete ANY object.
-- After:
--   read   = admin OR the object maps to a reading_attachments row whose asset
--            is accessible to the current user (site scoping)
--   insert = admin/engineer only (files are uploaded by lab entry, and the
--            metadata row is registered right after — no site info exists yet)
--   update/delete = admin/engineer AND site access to the linked asset
-- The join uses storage.objects.name = reading_attachments.storage_path (both
-- store the object path within the bucket, e.g. 'RE-1001/2026-07/172345-f.pdf').
drop policy if exists "lab_att_read"   on storage.objects;
drop policy if exists "lab_att_insert" on storage.objects;
drop policy if exists "lab_att_update" on storage.objects;
drop policy if exists "lab_att_delete" on storage.objects;

create policy "lab_att_read" on storage.objects
  for select using (
    bucket_id = 'lab-attachments'
    and auth.role() = 'authenticated'
    and (
      public.current_user_role() = 'admin'
      or exists (
        select 1
        from public.reading_attachments ra
        join public.assets a on a.id = ra.asset_id
        where ra.storage_path = storage.objects.name
          and public.can_access_site(a.site)
      )
    )
  );

create policy "lab_att_insert" on storage.objects
  for insert with check (
    bucket_id = 'lab-attachments'
    and auth.role() = 'authenticated'
    and public.current_user_role() in ('admin','engineer')
  );

create policy "lab_att_update" on storage.objects
  for update using (
    bucket_id = 'lab-attachments'
    and auth.role() = 'authenticated'
    and public.current_user_role() in ('admin','engineer')
    and exists (
      select 1
      from public.reading_attachments ra
      join public.assets a on a.id = ra.asset_id
      where ra.storage_path = storage.objects.name
        and public.can_access_site(a.site)
    )
  );

create policy "lab_att_delete" on storage.objects
  for delete using (
    bucket_id = 'lab-attachments'
    and auth.role() = 'authenticated'
    and public.current_user_role() in ('admin','engineer')
    and exists (
      select 1
      from public.reading_attachments ra
      join public.assets a on a.id = ra.asset_id
      where ra.storage_path = storage.objects.name
        and public.can_access_site(a.site)
    )
  );
