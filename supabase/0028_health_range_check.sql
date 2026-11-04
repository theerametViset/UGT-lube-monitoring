-- Migration 0028 — a machine's health score can never be negative (or above 100).
-- Run AFTER 0027.
--
-- compute_health() already clamps to 0–100, but assets.health had no
-- constraint, so a direct write (SQL editor, import, a future function) could
-- still store a negative score. Recompute every asset first so any stored
-- out-of-range value (and its status) is replaced by the real score before
-- the constraint is added.

select public.recompute_all_health();

alter table public.assets
  add constraint assets_health_range check (health between 0 and 100);
