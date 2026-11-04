-- Default the Overall Score Weighting to 100% Oil / 0% Vibration — plants
-- typically start with oil-only monitoring and enable vibration weighting
-- later per asset, rather than the other way around. Engineers can still
-- change this (globally, or per asset via asset_score_overrides) at any time
-- from the Alarm Configuration screen.
alter table public.score_config alter column oil_weight set default 100;
alter table public.score_config alter column vib_weight set default 0;

update public.score_config set oil_weight = 100, vib_weight = 0 where id = 1;
