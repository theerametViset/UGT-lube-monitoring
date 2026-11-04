-- Migration 0009 — Email notification configuration
-- Stores recipients + toggle per event type

create table if not exists public.notification_config (
  id                     int primary key default 1,
  from_email             text not null default 'alerts@ugt-reliability.com',
  email_recipients       text[] not null default '{}',
  enable_critical_alerts boolean not null default true,
  enable_pm_overdue      boolean not null default true,
  enable_wo_assigned     boolean not null default true,
  enable_weekly_summary  boolean not null default false,
  updated_at             timestamptz default now()
);

insert into public.notification_config (id) values (1) on conflict (id) do nothing;

alter table public.notification_config enable row level security;
drop policy if exists "notif_read" on public.notification_config;
drop policy if exists "notif_modify" on public.notification_config;
create policy "notif_read" on public.notification_config for select using (true);
create policy "notif_modify" on public.notification_config
  for all using (public.current_user_role() in ('admin','engineer'));
