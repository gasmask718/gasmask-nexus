# GasMask Nexus — Platform Integrity & Operational Audit

Scope is large enough that a single pass would produce a shallow report. This plan runs the audit in verifiable slices, each producing evidence in `docs/audits/`, then a prioritized fix list. No production writes during audit phases.

## What is already confirmed (checked before writing this plan)

- `sf_pool_map` holds 39 source mappings; `surplus_funds_leads` has **0 NULL pools** and **0 unmapped lead sources**. Surplus Funds classification is healthy.
- SBO crons 24, 25, 101, 104, 110, 121 all report `succeeded` in the last 24h (job 110 ran 72/72, job 101 twice, job 121 eight times).
- `sbo_capper_picks` is growing again (latest row 2026-08-17 11:41 UTC), but **only 26 of 2,614 picks (1.0%) carry `matched_prop_id`** — prop matching is effectively not producing coverage even though its cron succeeds.
- `_shared/errText.ts` and `src/lib/errText.ts` are byte-identical, and `prebuild` enforces the sync check alongside sidebar-route and public-view-grant gates.
- The unread-write reproduction grep in `docs/architecture/known-issues-unread-writes.md` currently returns **6,022 lines**, not the 1,038 recorded in the ticket. Either the codebase grew or the grep counts lines rather than call sites; the true number must be re-derived before any remediation is scoped.

## Audit phases

### Phase 1 — Financial safety (highest blast radius)
- Trace every path that calls Stripe: confirm the DB row exists before the PaymentIntent/charge, per the ordering hazard already ticketed in `docs/architecture/known-issues-payment-intent-before-rows.md`.
- Verify idempotency keys and event-id dedup on `ut-stripe-webhook`, `stripe-webhook`, `lender-webhook`, `ut-ingest`: replay the same event id twice against a test row and confirm a single ledger effect.
- Re-check `ut-process-refund` cannot 5xx after money moves (double-refund guard) and that refunds land as append-only `expense`/`refund` rows.
- Audit accumulator columns (ambassador totals, referral totals) against a derived SQL recomputation and report the drift per row.

### Phase 2 — Unread writes, re-scoped
- Re-derive the real count with a per-call-site scan (not a line count), split by blast radius: paid path / gates a later read / audit-telemetry / analytics.
- Deliver the classified inventory as a CSV in `docs/audits/`. Fix only tier 1 (paid path) in this pass using `verifiedInsert`/`verifiedUpdate`; leave tiers 3-4 unread on purpose and record that decision.

### Phase 3 — Edge function deployment state
- Classify every function in `supabase/functions/` as ACTIVE & PROVEN IN LOGS / DEPLOYED BUT UNPROVEN (0 logs) / FAILING or DEPRECATED, using log queries only — zero paid invocations.
- Cross-check external key configuration and budget gates (Stripe, Anthropic, Gemini, Telegram, Google Places, Viator) and report which have no spend cap.

### Phase 4 — Auth, roles and error visibility
- Exercise `/auth` in the browser: email/password sign-in, Google OAuth availability, session persistence across reload, token refresh, post-login redirect.
- Enumerate route guards vs. role sources and report any admin/OS route reachable without a role check.
- Grep for toast/error paths still rendering raw objects instead of `errText`, and list the offenders.

### Phase 5 — SBO prop matching (the confirmed defect)
- Diagnose why `sbo-match-capper-picks` succeeds while producing ~1% coverage: compare pick vocabulary, player-name normalization, and date windows against `sbo_player_props`.
- Report the failing join dimension with sample rows before proposing a fix.

### Phase 6 — Status vocabulary and schema drift
- Map enum vs. free-text status columns across partner/vendor tables and flag filters that can leak rows (e.g. a UI filtering `pending` against a column that also holds `suspended`/`rejected`).

## Deliverables

- `docs/audits/nexus-integrity-audit-2026-08-17.md` — executive dashboard with green / at-risk / broken classification per subsystem, each claim backed by a query or log reference.
- `docs/audits/nexus-unread-writes-inventory.csv` — classified write sites.
- A numbered remediation plan ordered: financial/data-loss → API reliability → UX polish, with each item marked fix-now vs. ticket.

## Technical notes

- Phases 1-6 are read-only: SQL `SELECT`, log reads, source reads, and browser interaction against the preview. The only writes are the audit documents.
- Idempotency proofs use existing QA fixtures (`is_qa_fixture`) so no real ledger rows are touched.
- No paid AI/API calls at any point; SBO and Places checks read logs and tables only.
- Any fix beyond tier-1 unread writes is proposed, not applied, in this pass.
