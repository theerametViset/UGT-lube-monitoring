-- =============================================================================
-- Migration 0014 — standards attachments (PDF originals in the Standards Library)
-- Adds: standard_attachments metadata table (+ RLS), private Storage bucket +
-- policies. Write to storage is limited to admin/engineer (unlike the legacy
-- lab-attachments bucket which allowed any authenticated upload).
-- =============================================================================

-- ---------- 1. metadata table ----------
create table if not exists public.standard_attachments (
  id           uuid primary key default gen_random_uuid(),
  standard_id  uuid not null references public.standards(id) on delete cascade,
  file_name    text not null,
  storage_path text not null,              -- path within bucket 'standard-attachments'
  mime_type    text,
  size_bytes   bigint,
  uploaded_by  uuid references public.profiles(id),
  created_at   timestamptz default now()
);
create index if not exists sa_standard_idx on public.standard_attachments (standard_id);

alter table public.standard_attachments enable row level security;

-- Standards are library-wide reference — any authenticated user can read.
drop policy if exists "sa_select" on public.standard_attachments;
create policy "sa_select" on public.standard_attachments
  for select using (auth.role() = 'authenticated');

drop policy if exists "sa_modify" on public.standard_attachments;
create policy "sa_modify" on public.standard_attachments
  for all using (public.current_user_role() in ('admin','engineer'))
  with check (public.current_user_role() in ('admin','engineer'));

-- ---------- 2. private Storage bucket ----------
insert into storage.buckets (id, name, public)
values ('standard-attachments', 'standard-attachments', false)
on conflict (id) do nothing;

-- ---------- 3. Storage object policies ----------
drop policy if exists "std_att_read"   on storage.objects;
drop policy if exists "std_att_insert" on storage.objects;
drop policy if exists "std_att_update" on storage.objects;
drop policy if exists "std_att_delete" on storage.objects;

create policy "std_att_read" on storage.objects
  for select using (bucket_id = 'standard-attachments' and auth.role() = 'authenticated');
create policy "std_att_insert" on storage.objects
  for insert with check (
    bucket_id = 'standard-attachments'
    and public.current_user_role() in ('admin','engineer')
  );
create policy "std_att_update" on storage.objects
  for update using (
    bucket_id = 'standard-attachments'
    and public.current_user_role() in ('admin','engineer')
  );
create policy "std_att_delete" on storage.objects
  for delete using (
    bucket_id = 'standard-attachments'
    and public.current_user_role() in ('admin','engineer')
  );
