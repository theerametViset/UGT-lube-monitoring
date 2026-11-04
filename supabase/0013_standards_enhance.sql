-- 0013_standards_enhance.sql
-- Standards library v2: version history + edit/delete support + links to
-- alarm params / asset types (for drill-down & alarm config integration).
alter table standards add column if not exists version int not null default 1;
alter table standards add column if not exists updated_at timestamptz not null default now();
alter table standards add column if not exists updated_by text;
alter table standards add column if not exists related_params text[] not null default '{}';
alter table standards add column if not exists asset_types text[] not null default '{}';
