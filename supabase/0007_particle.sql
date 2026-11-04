-- Migration 0007 — Particle Count fields (4/6/14μm) for oil_readings
alter table public.oil_readings
  add column if not exists particle_4 int,
  add column if not exists particle_6 int,
  add column if not exists particle_14 int;
