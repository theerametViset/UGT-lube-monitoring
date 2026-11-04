-- Migration 0026 — step (flat) penalty instead of linear interpolation.
-- Run AFTER 0025.
--
-- health_penalty() used to interpolate linearly between warn_penalty and
-- crit_penalty for any reading between the Warning and Critical limits, so
-- the Health Score Audit breakdown could show a deduction (e.g. -26) that
-- never appears in the Deduction Criteria Reference table shown right next
-- to it (which only lists the two endpoints, e.g. -20 / -40) — a visible
-- inconsistency. Switched to a step function: anywhere past Warning deducts
-- the flat Warning penalty, anywhere past Critical deducts the flat Critical
-- penalty. The deduction shown is now always exactly one of the two numbers
-- in the reference table. Mirrors lib/scoring/audit.ts's healthPenalty().

create or replace function public.health_penalty(
  p_val numeric, p_warn numeric, p_crit numeric,
  p_warn_pen numeric, p_crit_pen numeric
) returns numeric
language sql immutable as $$
  select case
    when p_val is null then 0
    when p_val > p_crit then p_crit_pen
    when p_val > p_warn then p_warn_pen
    else 0
  end;
$$;

-- Re-score every asset now that the deduction curve changed.
select public.recompute_all_health();
