-- Migration 0021 — tighten attachment storage RLS to match the app's site-scoped
-- access model (fixes: any authenticated user of any role/site could obtain a
-- signed URL for ANY asset's or work order's attachment, because the storage
-- policies only checked auth.role() = 'authenticated' with no per-object owner
-- check — the DB-row RLS for oil/vib readings and work orders already scopes by
-- site via public.can_access_site(), but storage.objects has no asset_id/wo_id
-- column, so we recover the owner id from the upload path's first folder segment
-- (uploads are always written as "<asset_id>/..." or "<wo_id>/...", see
-- DataEntryClient.tsx / WoAttachmentsPanel.tsx) and join back to check site access.
-- standard-attachments is intentionally left alone: standards are globally
-- readable by design (std_select ... using (true)), so "authenticated" is already
-- the correct scope for that bucket.

-- ---------- lab-attachments (oil/vib reading attachments, scoped by asset site) ----------
drop policy if exists "lab_att_read"   on storage.objects;
drop policy if exists "lab_att_insert" on storage.objects;
drop policy if exists "lab_att_update" on storage.objects;
drop policy if exists "lab_att_delete" on storage.objects;

create policy "lab_att_read" on storage.objects
  for select using (
    bucket_id = 'lab-attachments'
    and exists (
      select 1 from public.assets a
      where a.id = (storage.foldername(name))[1]
        and public.can_access_site(a.site)
    )
  );
create policy "lab_att_insert" on storage.objects
  for insert with check (
    bucket_id = 'lab-attachments'
    and public.current_user_role() in ('admin','engineer')
    and exists (
      select 1 from public.assets a
      where a.id = (storage.foldername(name))[1]
        and public.can_access_site(a.site)
    )
  );
create policy "lab_att_update" on storage.objects
  for update using (
    bucket_id = 'lab-attachments'
    and public.current_user_role() in ('admin','engineer')
    and exists (
      select 1 from public.assets a
      where a.id = (storage.foldername(name))[1]
        and public.can_access_site(a.site)
    )
  );
create policy "lab_att_delete" on storage.objects
  for delete using (
    bucket_id = 'lab-attachments'
    and public.current_user_role() in ('admin','engineer')
    and exists (
      select 1 from public.assets a
      where a.id = (storage.foldername(name))[1]
        and public.can_access_site(a.site)
    )
  );

-- ---------- wo-attachments (work order report files, scoped by WO's plant/site) ----------
drop policy if exists "wo_att_read"   on storage.objects;
drop policy if exists "wo_att_insert" on storage.objects;
drop policy if exists "wo_att_update" on storage.objects;
drop policy if exists "wo_att_delete" on storage.objects;

create policy "wo_att_read" on storage.objects
  for select using (
    bucket_id = 'wo-attachments'
    and exists (
      select 1 from public.work_orders w
      where w.id = (storage.foldername(name))[1]
        and public.can_access_site(w.plant)
    )
  );
create policy "wo_att_insert" on storage.objects
  for insert with check (
    bucket_id = 'wo-attachments'
    and public.current_user_role() in ('admin','engineer')
    and exists (
      select 1 from public.work_orders w
      where w.id = (storage.foldername(name))[1]
        and public.can_access_site(w.plant)
    )
  );
create policy "wo_att_update" on storage.objects
  for update using (
    bucket_id = 'wo-attachments'
    and public.current_user_role() in ('admin','engineer')
    and exists (
      select 1 from public.work_orders w
      where w.id = (storage.foldername(name))[1]
        and public.can_access_site(w.plant)
    )
  );
create policy "wo_att_delete" on storage.objects
  for delete using (
    bucket_id = 'wo-attachments'
    and public.current_user_role() in ('admin','engineer')
    and exists (
      select 1 from public.work_orders w
      where w.id = (storage.foldername(name))[1]
        and public.can_access_site(w.plant)
    )
  );
