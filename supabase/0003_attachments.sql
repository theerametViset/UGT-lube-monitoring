-- =============================================================================
-- UGT Reliability Lubrication AI Platform v3
-- Migration 0003 — lab file attachments (Data Entry feature)
-- Run AFTER 0001_schema.sql and 0002_seed.sql.
-- Adds: reading_attachments table (+ RLS), private Storage bucket + policies.
-- =============================================================================

-- ---------- 1. metadata table ----------
create table if not exists public.reading_attachments (
  id           uuid primary key default gen_random_uuid(),
  asset_id     text not null references public.assets(id) on delete cascade,
  period       text,                       -- 'YYYY-MM' (nullable: allow asset-level)
  kind         text check (kind in ('oil','vib')),
  file_name    text not null,
  storage_path text not null,              -- path within bucket 'lab-attachments'
  mime_type    text,
  size_bytes   bigint,
  uploaded_by  uuid references public.profiles(id),
  created_at   timestamptz default now()
);
create index if not exists ra_asset_period_idx on public.reading_attachments (asset_id, period);

alter table public.reading_attachments enable row level security;

drop policy if exists "ra_select" on public.reading_attachments;
create policy "ra_select" on public.reading_attachments
  for select using (
    exists (select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site))
  );

drop policy if exists "ra_modify" on public.reading_attachments;
create policy "ra_modify" on public.reading_attachments
  for all using (
    public.current_user_role() in ('admin','engineer')
    and exists (select 1 from public.assets a where a.id = asset_id and public.can_access_site(a.site))
  );

-- ---------- 2. private Storage bucket ----------
insert into storage.buckets (id, name, public)
values ('lab-attachments', 'lab-attachments', false)
on conflict (id) do nothing;

-- ---------- 3. Storage object policies (authenticated only) ----------
drop policy if exists "lab_att_read"   on storage.objects;
drop policy if exists "lab_att_insert" on storage.objects;
drop policy if exists "lab_att_update" on storage.objects;
drop policy if exists "lab_att_delete" on storage.objects;

create policy "lab_att_read"   on storage.objects
  for select using (bucket_id = 'lab-attachments' and auth.role() = 'authenticated');
create policy "lab_att_insert" on storage.objects
  for insert with check (bucket_id = 'lab-attachments' and auth.role() = 'authenticated');
create policy "lab_att_update" on storage.objects
  for update using (bucket_id = 'lab-attachments' and auth.role() = 'authenticated');
create policy "lab_att_delete" on storage.objects
  for delete using (bucket_id = 'lab-attachments' and auth.role() = 'authenticated');
