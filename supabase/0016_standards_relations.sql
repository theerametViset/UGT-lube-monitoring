-- 0016_standards_relations.sql
-- Standards library v4: explicit standard-to-standard cross-references
-- (distinct from related_params/asset_types, which link a standard to alarm
-- params / asset types, not to other standards).
alter table standards add column if not exists related_standard_ids uuid[] not null default '{}';

-- Backfill real cross-references found in existing full_text prose.
-- Title-keyed (id is db-generated, unknown at insert time). Idempotent.
update public.standards a set related_standard_ids = (
  select array_agg(b.id) from public.standards b where b.title in ('ASTM D4378-20', 'ISO 8068:2006')
) where a.title = 'ASTM D445-21';

update public.standards a set related_standard_ids = (
  select array_agg(b.id) from public.standards b where b.title in ('ASTM D445-21', 'ASTM D664-19')
) where a.title = 'ASTM D4378-20';

update public.standards a set related_standard_ids = (
  select array_agg(b.id) from public.standards b where b.title in ('ISO 10816-3:2009')
) where a.title = 'ISO 20816-1:2016';

update public.standards a set related_standard_ids = (
  select array_agg(b.id) from public.standards b where b.title in ('ISO 13373-1:2002')
) where a.title = 'ISO 13373-2:2016';

-- Formatting normalization: the 11 standards from 0015 use "|" between
-- sub-clauses in full_text; parseStandardLines only splits on "·". Normalize
-- so they render as proper bullets like the original 5.
update public.standards set full_text = replace(full_text, ' | ', ' · ')
where title in (
  'ISO 11158:2009','ISO 12925-1:2018','ISO 8068:2006','ASTM D445-21','ASTM D664-19',
  'ISO 13373-1:2002','ISO 13373-2:2016','ISO 20816-1:2016','ISO 13379-1:2012',
  'ISO 14224:2016','IEC 60812:2018'
);
