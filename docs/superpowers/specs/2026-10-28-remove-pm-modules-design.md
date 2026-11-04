# Remove the PM Management Center — design

Date: 2026-10-28 · Status: approved in chat ("โอเค", "ทำทั้งหมด")

## Goal
The app becomes lubrication monitoring only. Every module in the sidebar group
"PM MANAGEMENT CENTER" is removed from the app.

## Decisions
- Scope **C**: all 9 items — PM Compliance Hub, PM Calendar, Work Orders,
  PM Master Setup, PM Alert Center, EAM Reporting, AI Reliability Center,
  AI Fleet Chat, Budget Tracker.
- Depth **2**: delete app code; **do not touch the database**. Tables
  (`pm_tasks`, `work_orders`, `alerts`, budget tables), RLS, permission rows and
  every `supabase/*.sql` file stay as they are. Dropping them is a separate,
  later migration.
- Abnormal lab result → Data Entry shows the text **"ค่าเกินเกณฑ์ ควรเปิดงานซ่อม"**
  instead of the Work Order draft. No copy button.

## Removed
- Routes: `app/(app)/{pm,work-orders,budget,eam,ai-reliability,ai-chat}`,
  `app/api/ai/fleet-chat`, `app/(print)/print/ai-chat`.
- Components: `components/{pm,workorders,budget,eam,ai-reliability}`,
  `components/ai/{AiChatClient,AiChatPrintDoc}`.
- lib: `queries/{pm,workorders,alerts,budget,eam}`,
  `actions/{pm,workorders,alerts,budget}`, `ai/fleet.ts`, and the PM / WO /
  alert / budget / EAM generators in `lib/demo-data.ts`.
- Nav: the `pm` section in `lib/nav.ts`.
- Permission keys (app catalog + demo roles): `pm:read`, `pm:write`,
  `alerts:manage`, `workorders:read`, `workorders:write`, `budget:read`,
  `budget:write`, `eam:read`, `reliability:read`, `aichat:read`. The Roles page
  hides these keys even when Supabase still returns them.

## Changed
- Data Entry: drop `woDraft` / `createWorkOrder`; show the warning text when the
  result is Warning or Critical.
- Dashboard: drop `canCreateWo` and its create-WO button.
- Global search: no Work Order results (update `search.test.ts`).
- Weekly digest: no PM-overdue / WO sections; asset health summary only.
- Notification settings: hide the PM-overdue and WO-assigned toggles; saving
  keeps their stored values unchanged.
- Demo audit log: drop the `work_orders` sample row.

## Unchanged
Health Score (`compute_health`, `lib/scoring/audit.ts`), Drill-down + AI
Diagnostic, `api/ai/{diagnose,rca,exec-summary,standard}` (used by Drill-down,
Reports, Standards), Sampling, Reports, `maintenance:write` (Asset page uses it),
all SQL migrations.

## Verification
`npm run typecheck`, `npm run lint`, `npm run build`, `npm test` pass. In Demo
Mode the sidebar shows the main group + Admin only, removed URLs return 404,
and health scores match across Dashboard / Watchlist / Drill-down.
Docs (`PRD.md`, `AGENTS.md`, `Plan.md`) updated to match.

## Task order
1. Delete routes, components, lib modules.
2. Fix the pages that still import them (Data Entry, Dashboard, search,
   digest, notifications, roles, demo-data, nav).
3. typecheck → lint → build → test until green.
4. Update docs.
