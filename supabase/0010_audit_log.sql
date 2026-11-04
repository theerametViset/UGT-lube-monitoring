-- Migration 0010 — Audit Trail (log การแก้ไขข้อมูล)
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id),
  action      text not null,
  table_name  text not null,
  record_id   text,
  old_value   jsonb,
  new_value   jsonb,
  ip_address  text,
  created_at  timestamptz default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_table_idx on public.audit_log (table_name);

alter table public.audit_log enable row level security;
create policy "audit_read" on public.audit_log for select using (public.current_user_role() in ('admin','engineer','manager'));
