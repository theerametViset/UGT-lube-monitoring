-- =============================================================================
-- UGT Reliability Lubrication AI Platform v3
-- Migration 0012 — audit_log insert policy (audit fix AUD-007)
-- Run AFTER 0011. 0010 enabled RLS on audit_log but only defined a SELECT
-- policy, so the logAudit() server action could never write entries (the page
-- was always empty). Users may insert only entries attributed to themselves.
-- =============================================================================

drop policy if exists "audit_insert" on public.audit_log;
create policy "audit_insert" on public.audit_log
  for insert with check (user_id = auth.uid());
