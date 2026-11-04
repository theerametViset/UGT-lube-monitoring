-- Migration 0031 — stop scoring Copper (Cu) and Silicon (Si). Run AFTER 0030.
--
-- The plant's lab reports don't measure Cu or Si, so they were dropped from the
-- app on 2026-10-28 to keep data entry simple. compute_health only scores
-- parameters that have an alarm_params row, so deleting the rows (and any
-- per-asset overrides for them) removes their deductions everywhere.
-- The oil_readings.cu / .si columns and any values already in them are KEPT.
--
-- To restore: re-insert the cu/si rows from 0002_seed.sql + 0008 penalties.

delete from public.asset_alarm_overrides where category = 'oil' and key in ('cu', 'si');
delete from public.alarm_params where category = 'oil' and key in ('cu', 'si');

select public.recompute_all_health();
