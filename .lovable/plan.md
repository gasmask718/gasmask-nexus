# Dynasty Capital — Implementation Plan (post-audit)

Full audit: `/mnt/documents/dynasty-capital-phase1-audit-2026-08-10.md`.

## What the audit actually found

The three systems are real, not mock. Nothing fabricates numbers. The problems are **empty data, split identity, and automation that has never run**.

- Funding Hub: 2 clients, 1 application, working credit-repair and PostGrid mail — but **0 lenders**, so matching cannot function.
- Grant OS: healthy (11 opportunities, 110 eligibility results) but it tracks **Dynasty's own 11 companies**, not funding clients. `grant_applications.funding_client_id` is NULL on all 6 rows. Zero name overlap with `funding_clients`.
- Automation Engine: built correctly (isolated Playwright worker, real checkpoint halts for CAPTCHA/OTP/e-sign, per-job browser context) but `automation_jobs` has **never held a row**.
- RLS is sound and is not a blocker. Eight `/funding-machine/*` routes are honest placeholders.

Because of the identity split, **a Capital Plan is not computable for any client today**. That is the central thing to fix.

## Phase 3 — Security blockers (first, small)

- Role-gate five grant edge functions that run under service role with **no in-code auth check**: `generate-grant-draft`, `grant-auto-apply`, `grant-eligibility-check`, `grant-opportunity-intake`, `grant-profile-completeness`. Any authenticated OS user can currently invoke them.
- Wrap the six `/os/uben/*` routes in `RequireRole` (currently unguarded).
- Label the Plaid integration as SANDBOX in the Velocity UI so sandbox balances are never read as live banking data.

## Phase 4 — Identity bridge (unblocks everything downstream)

- Add nullable `grant_business_profiles.funding_client_id → funding_clients(id)`. Dynasty's own entities stay client-less; client businesses get linked.
- Backfill `grant_applications.funding_client_id` from the linked profile; make it required for new client-facing grant applications.
- Consolidate the two competing eligibility engines: keep `grant-eligibility-checker` (453 lines, richer), deprecate `grant-eligibility-check`, and have `client_grant_matches` and `grant_eligibility_results` resolve to one identity.

## Phase 5 — Lender data + matching

- Lender importer already exists and is routed (`/funding-machine/lender-import`). Harden its validation (required fields, duplicates, submission method must be one of API/BROWSER/MANUAL, URL and date checks) and report Imported/Updated/Skipped/Errors.
- Populate `funding_lender_database` + `funding_lender_products` with real lender data, each row carrying submission method, automation-permitted flag, and eligibility thresholds.
- Extend `lender-matching-engine` to emit MATCHED / NOT MATCHED / REQUIRES PREREQUISITE / MANUAL REVIEW with a per-rule explanation, reading thresholds from the lender row and prerequisites from `funding_infrastructure_checklist`. No lender is shown as qualified unless every rule passes.
- Move funding-strategy ordering into configurable rules (a `funding_strategy_rules` table), not into components.

## Phase 6 — Capital Plan read-model

- One SQL view per client aggregating funding applications + grant applications into Requested / Approved / Funded / Pending. No new storage, no duplicated logic.
- Extract the missing hooks layer (`useCapitalPlan`, `useLenderMatches`, `useFundingClient`) so pages stop owning inline queries and scoring thresholds.

## Phase 7-8 — Automation proof

- Seed `lender_automation_config` and `automation_field_mappings` for one real lender.
- Run one job end-to-end: claim → fill → human checkpoint → submit → response capture → application update, verified against `automation_events`.
- Verify idempotency: an interrupted RUNNING job must not resubmit without reconciliation.

## Phase 9-10 — Dynasty Capital UI + Empire HUD

- `/dynasty-capital`: Clients, Funding, Grants, Applications, Automation, Capital Secured — all reading the Phase 6 view, adding no new tables.
- Empire HUD consumes the same view; no operational logic duplicated there.

## Phase 11 — QA

Functional, negative, cross-client security (two real accounts, tested against the API directly and not only the UI), edge cases (API failure, browser crash, timeout, duplicate submit, session expiry), and regression across the existing funding-machine surface.

## Technical notes

- Reuse decisions: `funding_clients` stays the single client of record; `funding_lender_database`/`funding_lender_products`/`lender_automation_config` are the lender store (retire the empty `lenders` table); `funding-automation-api` and the worker are kept as-is; `compute_funding_dfs` + `funding_dfs_weights` already provide configurable scoring.
- The 8 `FundingModuleStub` routes stay labelled as placeholders until their phase arrives.

## Suggested first step

Phase 3 + Phase 4 together — they are small, they are the only true blockers, and nothing else can be verified end-to-end until client identity is unified.
