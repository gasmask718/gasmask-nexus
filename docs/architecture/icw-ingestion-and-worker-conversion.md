# ICW ingestion, run history and applicant → worker conversion

Closed out 2026-09-14. Ingestion + dedupe + run logging + conversion. **No outreach.**

## What was already there

- `icw_sourced_leads` (47 rows) — businesses. Dedupe in `src/lib/icw/leadIngestion.ts`:
  license → phone (country-scoped key) → name+address / name+city+state, plus the
  registered-address-only map-pin rule.
- `icw_candidate_leads` (7 rows) — individual applicants, `src/lib/icw/candidateIngestion.ts`:
  source_id → phone → name+city+state. Ingest can never push past `reviewing`.
- `icw_workers`, `icw_jobs`, dispatch RPCs, `/os/icw/{,,workers,my-jobs,map,crm}` surfaces.
- `icw_ingestion_runs` table — existed, **never written by any code** (0 rows).

## What was broken

1. **Run history was fiction.** No caller of `icw_ingestion_runs`; `ingestion_run_id`
   on both lead tables was always null.
2. **No applicant → worker path.** `promoted_worker_id` / `converted_worker_id` existed
   with no writer; `icw_workers` was empty and the roster said the sync "isn't wired".
3. **The 7 applicants had no screen.** `icw_candidate_leads` was read by no page.
4. **No ingestion schedule.** Only `icw-expire-worker-responses` (cron 127, */10) exists —
   that is dispatch timeout handling, not ingestion. Deliberately left unscheduled.

## What was added (reuse, not rebuild)

- `src/lib/icw/ingestionRuns.ts` — `startIngestionRun` / `completeIngestionRun`. Both batch
  helpers now open a run before the first write, stamp `ingestion_run_id` on every row they
  touch, and close it with real counts, or `outcome='failed'` + `error_detail` on throw.
  A run that dies is visible instead of absent.
- `public.icw_promote_to_worker(_source text, _record_id uuid)` — SECURITY DEFINER, owner/admin
  only. Idempotent: an already-promoted record returns the same worker
  (`already_promoted`). Identity is reused, not duplicated — a worker matching on last-10
  phone or lowercased email is linked and enriched (`linked_existing_worker`) rather than
  inserted a second time. Only a genuinely new person yields `worker_created`.
  The source row is stamped `promoted` / `converted` + worker id, so provenance survives.
- `/os/icw/candidates` (`ICWCandidateQueue.tsx`) — applicant queue with the
  candidate → reviewing → qualified → rejected transitions, a promote button gated on
  `qualified`, and the last 10 ingestion runs. Sidebar entry "ICW Applicants".
- `ICWCrm.tsx` — same promote action for qualified business leads.

## Acceptance results (2026-09-14, real browser session, admin)

| test | result |
|---|---|
| ingest one lead | inserted, run `087eb0bd…` |
| re-ingest same lead | 0 new / 1 duplicate, matched `source_id`, same lead id |
| ingest + re-ingest applicant | inserted, then 0 new / 1 duplicate on `source_id` |
| run history | 4 runs with source, query, geography, raw/new/duplicate, outcome `success` |
| queue transitions | candidate → reviewing → qualified via the row picker |
| promote | `worker_created`, row flips to `converted`, worker in `/os/icw/workers` |
| promote again | `already_promoted`, same worker id — no second identity |
| same human as a business lead (same phone) | `linked_existing_worker` — still exactly 1 worker row |
| cleanup | leads 47, applicants 7, workers 0, runs 0 — back to baseline |

## Still open

- **No ingestion cadence.** Ingestion is manual and now observable; a schedule should only be
  added once the owner names sources, geographies and frequency.
- **No source connector.** Ingestion runs from the shared helpers; there is no ICW scraper
  edge function pulling from a named platform.
- ICW leads stay in the ICW-specific tables (licence fields, registered-address rule,
  worker conversion) rather than `business_leads`; the shared canonical pool has no
  equivalent of those fields, so migrating would lose them.
