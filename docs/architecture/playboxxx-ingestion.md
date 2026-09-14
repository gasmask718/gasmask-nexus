# Playboxxx ingestion — audited state and current path (2026-09-14)

## Live state at audit time
- `business_leads`: 297,010 `ut`, 7 `playboxxx` (all `status = 'new'`, created 2026-09-09/10,
  source `playboxxx_make_ingest` — 5 Instagram creators + 2 Overpass businesses, i.e. verification
  samples, not production ingestion). No Playboxxx-specific lead tables exist.
- Edge function `playboxxx-recruiting-ingest` deployed, `verify_jwt = false`, secret
  `PLAYBOXXX_INGEST_SECRET` configured — **zero invocations logged. Make.com is not calling it.**
- `overpass-discovery` is a stateless proxy: it persists nothing.
- No cron job exists for Playboxxx or Overpass. `lead_ingestion_runs` was empty.
- Most Playboxxx recruiting pages are placeholders; only `Candidates.tsx` and
  `RecruitingDashboard.tsx` read real data.

## Current path (after this pass)
Two lanes, one canonical home each. A person is never stored as a business.

| Lane | Roles | Target | Dedupe order |
|---|---|---|---|
| business | beauty, private_chef, cleaner, decorator, florist, staff… | `ingest_business_lead()` → `business_leads` (`business = 'shared'`) + `business_lead_eligibility(company='playboxxx')` | source_record_id → phone(last10) → website domain → name+address |
| creator | model, creator, photographer, cameraman, videographer | `ingest_recruiting_applicant()` → `recruiting_applicants` + `recruiting_applications` | email → phone(last10) → instagram handle |

- Creator applications are stamped with campaign `PBX-SOURCING`, business slug `playboxxx`.
- Creator-lane leads may omit state (applicants allow it); business-lane still requires a 2-letter US state.
- Every batch opens a `lead_ingestion_runs` row first and closes it with real counts, or marks it
  `failed` with the error. A run that cannot be opened aborts the batch — no unaudited ingestion.
- Queue view `v_playboxxx_business_leads` unions shared-lane eligible rows (`record_lane='shared'`)
  with the 7 legacy `business='playboxxx'` rows (`record_lane='legacy_playboxxx'`), both
  anti-joined against `dnc_list` and `opt_out_events`. `Candidates.tsx` reads this view.
- The 7 legacy rows were preserved, not migrated.

## Acceptance test (2026-09-14, temporary records, all removed)
1. Unsigned request → 401.
2. Batch of 1 business + 1 creator → both inserted, run logged.
3. Same batch again → business `duplicate` matched on `source_record_id`; creator matched as the
   same person (second role added, no second person).
4. Provenance verified: source, source_record_id, ingestion_run_id, times_seen = 2.
5. Business visible in `v_playboxxx_business_leads` with `playboxxx` eligibility attached.
6. Non-US lead rejected with a clear reason and counted as invalid on the run.
7. No outreach at any point — the path only stores, dedupes and routes.
8. Cleanup verified: back to 7 legacy rows / 0 applicants / 0 runs / 0 eligibility rows.

## Open / blocked
- **Make.com is not invoking the webhook** — no production ingestion is happening. Either point
  the Make scenario at `/functions/v1/playboxxx-recruiting-ingest` with the `x-playboxxx-secret`
  header, or replace it with a direct Nexus-side Overpass run (the proxy already exists).
- **No schedule.** Deliberately not invented. Ingestion is manual and observable first.
- **No approved sourcing config** (metros, categories, creator search terms) exists in the project.
