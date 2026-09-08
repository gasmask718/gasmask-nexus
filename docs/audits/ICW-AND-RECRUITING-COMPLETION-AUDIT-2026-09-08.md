# ICW + Dynasty Recruiting/Content Ecosystem — Completion Audit
Date: 2026-09-08 (UTC) · Mode: **read-only**. No code, data, migration, permission, automation or outreach change was made.
Method: live database queries (row counts, schemas, functions, triggers), source inspection of `src/` and `supabase/functions/`, route/UI wiring inspection. Documentation was NOT accepted as evidence of completion.

---

# WORKSTREAM A — ICW (I Clean We Clean)

## Live data snapshot (queried 2026-09-08)

| Object | Rows | Note |
|---|---|---|
| `public.icw_state_config` | **51** | all 50 states + DC |
| `public.icw_sourced_leads` | **47** | business/provider leads, 20 with lat/long |
| `public.icw_candidate_leads` | **7** | 5 care.com, 1 craigslist, 1 application_form; all `candidate`, 0 converted |
| `public.icw_workers` | **0** | empty |
| `public.icw_jobs` | **0** | empty |
| `public.icw_dispatch_log` | **0** | empty |
| `public.icw_ingestion_runs` | **0** | empty — no run has ever been recorded |

## DONE (verified working end to end)

1. **ICW canonical tables reused, no duplicate system** — `icw_workers`, `icw_jobs`, `icw_state_config`, `icw_dispatch_log` are the only worker/job/dispatch tables; `icw_sourced_leads` (providers) and `icw_candidate_leads` (applicants) are the only lead tables. No parallel/duplicate ICW schema exists. *Evidence:* full `information_schema` scan for `icw|clean` returned no competing tables. **Required: yes — satisfied.**

2. **Dispatch + licensing gate engine** — `public.icw_dispatch_job(uuid)` (SECURITY DEFINER) with helpers `icw_category_gate(text)`, `icw_worker_is_available(text)`, fired automatically by trigger `icw_jobs_auto_dispatch` on `icw_jobs`. Licensing gate runs first, gated+unverified ⇒ `blocked_licensing`; matching load-balances on active job count; zero candidates ⇒ `unmatched`; every branch writes `icw_dispatch_log`. Verified by controlled throwaway tests (all five paths passed, rows removed). *Live data:* zero production jobs. **Required: yes — code complete, unexercised in production.**

3. **State licensing reference data** — `icw_state_config` fully populated for 51 jurisdictions: `tier`, `priority_rank`, `verified=true` on all 51, `confidence`, `handyman_license_status`, `source`, `last_verified_date` (2026-08-26). **Required: yes — but see PARTIAL #1, the gate columns the engine reads are empty.**

4. **Public cleaner application intake** — `src/pages/apply/ICWCleanerApplication.tsx` → edge function `icw-candidate-apply` (`verify_jwt = false` in `supabase/config.toml:618`) → `icw_candidate_leads` with dedupe, consent capture, UTM/referral attribution, zero outreach and zero auto-approval. *Live data:* 1 real `application_form` row. **Required: yes — satisfied.**

5. **Lead dedupe + provenance** — `src/lib/icw/leadIngestion.ts` (463 lines) and `src/lib/icw/candidateIngestion.ts`: country-scoped phone normalisation, `source_id`+`source_platform` key, email key, licence-number key, and explicit `same_run_self_match` vs `duplicate_preexisting` outcomes. Provenance columns present and populated: `source_platform`, `source_url`, `source_id`, `ingestion_run_id`. **Required: yes — satisfied.**

6. **Worker roster UI with real writes** — `src/pages/os/iclean/ICWWorkerRoster.tsx` reads `icw_workers` live and approves/rejects through `verifiedUpdate` (OS convention). Route `/os/icw/workers`. **Required: yes — code satisfied; no roster data to operate on.**

7. **Command dashboard attention counters** — `ICWCommandDashboard.tsx` live-counts workers, jobs, `blocked_licensing`, `unmatched`, shows latest dispatch-log notes and a `verifiedUpdate`-based "Re-run dispatch". Route `/os/icw`. **Required: yes — satisfied.**

8. **Category taxonomy incl. Floors and Professional Reorganizer** — `src/lib/icw/categories.ts` defines the single source of truth: Cleaning, Mobile Wash, Lawn Care, Snow Removal, Handyman, Moving, **Floors**, **Professional Reorganizer** (a distinct top-level category, not folded into Cleaning). **Required: yes — satisfied at the taxonomy layer; see PARTIAL #4 for the gate mismatch.**

## PARTIAL

1. **Licensing gate columns are empty** — `icw_state_config.handyman_license_gate` and `specialty_license_gate` are **NULL on all 51 rows** (`count(handyman_license_gate)=0`, `count(specialty_license_gate)=0`). The dispatch engine gates on `verified`, which is `true` everywhere, so **no job can ever be blocked in practice today**. The real licensing signal lives in `handyman_license_status` (`Y`, `N_GC_ONLY`, `DEPENDS`, `Y_HIC_LICENSE`, `LOCAL_ONLY`, …), which the engine does not read. *Remains:* map `handyman_license_status`/`pest_control_license_required`/`restoration_threshold_usd` into the boolean gate columns, or point the engine at them. **Required: yes — this is the single highest-risk ICW gap.**
   Also note every row's `notes` says *"review by licensing attorney before operational use"* — `verified=true` is a research flag, not a legal clearance.

2. **Job intake is a stub** — `supabase/functions/icw-intake/index.ts` is 29 lines and logs `[icw-intake] stub invoked`, returning `{stub:true}`. It **persists nothing**. `icw-status-sync` is an identical 29-line stub. So `icw_jobs` can only be created by hand; the dispatch trigger has no real upstream. **Required: yes.**

3. **ICW Map is thin and mostly unplottable** — `ICWLeadMap.tsx` (156 lines) queries `icw_sourced_leads` live, but only **20 of 47** rows have `latitude/longitude`; there is no geocoding step in the ingestion path. Map shows providers only — no jobs, no workers, no coverage/zone layer. **Required: partially — usable but not decision-grade.**

4. **Category ↔ gate taxonomy mismatch** — `ICW_LICENSE_GATED_CATEGORIES` in `categories.ts` = `['Handyman','Floors']`, while the DB `icw_category_gate()` was built around Handyman & Repair plus the Phase-2 specialty set (biohazard, water/fire restoration, pest control). **Floors is gated in the frontend and not in the DB; the Phase-2 categories do not exist in the frontend taxonomy at all.** Two sources of truth are now diverging. **Required: yes.**

5. **ICW CRM is read-only** — `ICWCrm.tsx` (252 lines) selects `icw_sourced_leads` and renders it. No status transitions, no notes, no assignment, no promote-to-worker action (`promoted_worker_id` is NULL on all 47 rows). **Required: yes for an operable CRM.**

6. **Cleaner lead/signup automation is manual** — the intake form works, but `icw_ingestion_runs` has **0 rows**: no scraper, cron or scheduled sourcing job has ever run. The 47 sourced leads (yelp, craigslist, business_website, companies_house_uk, yellow_pages_au, plus `test_seed*` rows) were loaded ad hoc, and some are non-US (England, Connacht, Munster, QLD, VIC, ON, BC) with no state. **Required: yes.**

7. **Applicant → worker onboarding has no path** — `icw_candidate_leads.converted_worker_id` exists but there is **no admin UI anywhere in `src/` that reads `icw_candidate_leads`** (only `candidateIngestion.ts` and the public apply page reference it) and no conversion function. Seven applicants are stranded. **Required: yes.**

8. **`/iclean` dashboard is mock** — `src/pages/os/iclean/ICleanDashboard.tsx` renders hardcoded `stats` and `todaysJobs` arrays with no Supabase call, and is routed at both `/os/iclean` and `/iclean/*`. It is presentation only and contradicts the real (empty) data. **Required: no — but it is actively misleading and should be removed or wired.**

## BLOCKED

1. **Legal clearance on licensing gates** — every `icw_state_config.notes` requires attorney review before operational use. Dispatching a gated category is an owner/legal decision, not an engineering one. *Blocker owner:* business owner + licensing counsel.
2. **No booking source** — `icw-intake` cannot be completed until the upstream booking/quote surface (or the external system posting bookings) is specified. *Blocker owner:* business owner.

## NOT STARTED

1. **Worker notification / accept-decline flow** — explicitly deferred; `matched` is the terminal state. No notification code exists. **Required: yes for a live operation.**
2. **Geocoding for ICW leads** — no function geocodes `icw_sourced_leads`. **Required: yes for the map.**
3. **Canonical lead/account mapping** — ICW leads are **not** mapped into `business_leads`, `store_master` or any canonical account object; the ICW tables are a closed island. Map and CRM read the same one table, so "map + CRM connectivity" is co-incidental, not integrated. **Required: decision needed — see quick wins.**
4. **Scheduled sourcing / ingestion runs** — no cron, no scraper for ICW.
5. **Pricing / payments / job lifecycle past `matched`** — `icw_jobs.price` exists and is unused.

---

# WORKSTREAM B — DYNASTY RECRUITING & CONTENT ECOSYSTEM

**Headline finding: the generic, multi-business recruiting system described in the planning docs does not exist in this project.** What exists is one UT-specific automation plus one single-purpose Playboxxx ingest webhook. Nothing was generalised.

## Live data snapshot

| Object | Rows |
|---|---|
| `public.recruiting_pipeline` | **does not exist** |
| `public.ut_leads` | **0** |
| `public.ut_recruiting_leads` | **0** |
| `public.ut_outreach_log` / `ut_outreach_logs` / `ut_outreach_sequences` / `ut_growth_reports` | **0 / 0 / 0 / 0** |
| `public.ut_campaigns` | 5 rows, all `active` (Venue Partner SMS, Staff Recruitment SMS, Ambassador Instagram DM, Party Business Owner Email, Direct Customer Acquisition) |
| `public.business_leads` | 297,010 rows, **all `business='ut'`**, newest 2026-08-26 |
| Playboxxx rows in `business_leads` | **0** |

## DONE

1. **UT scraper → grade → outreach code path exists and is coherent** — `supabase/functions/ut-lead-scraper/index.ts` (writes `ut_leads`, `ut_automation_runs`, reads `ut_lead_sources`) and `supabase/functions/ut-growth-engine/index.ts` (347 lines) with actions `run_sms_outreach`, `run_email_outreach`, `queue_instagram_dms`, filtering `grade in ('A','B')` and `outreach_sent_at is null`, logging to `ut_outreach_log`, updating `ut_campaigns`. SMS is correctly classed through `_shared/twilioSend.ts` / `send-sms`. **Code: yes. Live data: zero.**
2. **Playboxxx recruiting ingest webhook** — `supabase/functions/playboxxx-recruiting-ingest` + `_shared/playboxxxLeadNormalize.ts`, `business='playboxxx'` scoping, unknown-role rejection, partial unique index, `verify_jwt=false`, `PLAYBOXXX_INGEST_SECRET` header auth. Documented at `docs/architecture/playboxxx-recruiting-ingest.md`. **Deployed and configured — but has received 0 rows.**
3. **Channel credentials present** — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_FROM_NUMBER`, Brandaro sub-account set, `SENDGRID_API_KEY`, `RESEND_API_KEY` all exist as server secrets. **Twilio: configured. SendGrid: configured.**

## PARTIAL

1. **Shared lead table exists but is single-tenant in practice** — `business_leads` has the mandatory `business` column and per-business views, which is the right generic substrate, but 100% of the 297,010 rows are `ut`. No recruiting business other than UT has ever written to it. **Required: yes.**
2. **UT recruiting automation has never run against real leads** — `ut_leads = 0`, `ut_outreach_log = 0`, `ut_recruiting_leads = 0`. The five `ut_campaigns` are marked `active` with nothing behind them, which is a false "on" signal on any dashboard reading campaign status. **Required: yes.**
3. **IG/DM path is draft-generation only** — `queue_instagram_dms` uses an LLM to write DMs into `ai_dm_message` on the prospect row. There is no delivery integration, no ManyChat, no send. **Required: decision needed.**
4. **Application/landing pages exist per-brand, not as a reusable template** — e.g. `/apply/cleaner` (ICW), ambassador apply pages. There is no parameterised application-page generator for a new business. **Required: yes for "reusable new-business onboarding".**
5. **Alerting exists generally, not for recruiting** — the OS has `system_alerts`, `system_alert_config`, `comms_health_alerts`, `health_check_alerts`, plus the daily `ops-alert-heartbeat`/`comms-health-monitor` pattern. **None of it monitors recruiting**: no recruiting delivery check, no auth check, no page-health check, no recruiting escalation. **Required: yes.**

## BLOCKED

1. **ManyChat** — no credential, no code, no reference anywhere in `src/` or `supabase/` (grep for `manychat`: zero hits outside this report). IG/DM automation cannot proceed. *Blocker:* account + API credential + owner decision on whether ManyChat is still the chosen tool.
2. **Playboxxx go-live** — webhook is ready and secret-gated; nothing is sending. *Blocker:* Make.com scenario on the external side.

## NOT STARTED (no real implementation — code, DB, UI or config)

| Item | Evidence |
|---|---|
| Generic/shared `recruiting_pipeline` table | grep `recruiting_pipeline` across `src/` + `supabase/`: **0 hits**; table absent from `information_schema` |
| Business + role/category switch matrix | 0 hits |
| `pending_test` / `on` / `off` state machine | grep `pending_test`: **0 hits** |
| Pre-flight test sequencer | no such function or table |
| Test SMS harness | none (all SMS paths are production sends) |
| Test email harness | none |
| IG/DM test path | none |
| Application-form end-to-end test | none |
| Automatic activation rules | none |
| Circuit breaker / auto-pause for recruiting | grep `circuit.?break`: **0 hits**. `auto-pause` hits are UT **API-budget** capping (`useUTApiBudget.ts`, `places-client.ts`, `predictive-dialer-engine`), a different concern |
| Delivery / auth / page-health checks for recruiting | none |
| Recruiting-specific alerting via SMS/Slack | none |
| Escalation on unacknowledged alert | none |
| Reusable new-business onboarding flow | none |
| Outreach template library (multi-business) | only hardcoded/LLM-generated strings inside `ut-growth-engine` |

---

# SCORECARD

## ICW COMPLETION %: **~45%**
Weighted by required capability, not file count. Schema + dispatch engine + dedupe/provenance + intake form + roster/dashboard UI are real (that is most of the "core"), but the licensing gate is inert, job intake is a stub, there are zero workers and zero jobs, and nothing exists past `matched`.
- Data layer: 85% · Dispatch logic: 80% (inert gate) · Lead ingestion: 55% · Onboarding: 20% · Job intake: 5% · Map/CRM: 40% · Notification/lifecycle: 0%

## ICW TRUE REMAINING WORK
1. Populate/repoint the licensing gate columns so gating actually fires (**critical — the system currently cannot block anything**).
2. Reconcile the two category-gate sources of truth (`categories.ts` vs `icw_category_gate()`), including Floors and the Phase-2 specialty set.
3. Replace the `icw-intake` stub with real `icw_jobs` persistence (and decide the upstream booking source).
4. Build applicant → worker conversion (`icw_candidate_leads.converted_worker_id`) plus an admin review screen — 7 applicants are stranded with no UI.
5. Seed a real worker roster; nothing can dispatch against 0 workers.
6. Geocode `icw_sourced_leads` (27 of 47 unplottable) and add jobs/workers layers to the map.
7. Make the CRM actionable (status transitions, notes, promote-to-worker).
8. Build worker notification / accept-decline (explicitly deferred, still required).
9. Retire or wire the mock `ICleanDashboard`.
10. Decide whether ICW leads map into the canonical `business_leads` universe or stay an island.

## RECRUITING SYSTEM COMPLETION %: **~18%**
One brand-specific automation with zero live throughput, one idle ingest webhook, credentials in place. The generic pipeline, state machine, test sequencer, circuit breaker, health checks and alerting — the bulk of what was specified — do not exist.
- Credentials: 70% (no ManyChat) · UT automation code: 65% · Live throughput: 0% · Generalisation: 5% · Test sequencer: 0% · Safety/alerting: 0% · Onboarding kit: 0%

## RECRUITING TRUE REMAINING WORK
1. Create the generic `recruiting_pipeline` (business × role/category × state) with `pending_test | on | off`.
2. Generalise `ut-growth-engine` from `ut_*` tables to the shared `business_leads` substrate with a `business` parameter.
3. Build the pre-flight test sequencer: test SMS, test email, IG/DM test, application-form round trip — each writing a pass/fail record.
4. Implement automatic activation (`pending_test` → `on` only when all pre-flight checks pass).
5. Implement the recruiting circuit breaker / auto-pause on delivery-failure, bounce or complaint thresholds.
6. Add delivery / auth / page-health monitors and wire them into the existing alert + heartbeat pattern, with escalation on non-acknowledgement.
7. Build the reusable new-business onboarding kit: templates, application/landing page generator, channel binding.
8. Resolve ManyChat (or replace the IG/DM channel).
9. Turn on real lead flow — every recruiting table is currently empty.

## QUICK WINS THAT CAN BE CLOSED NOW
- Populate `handyman_license_gate` / `specialty_license_gate` from the already-researched `handyman_license_status` + pest/restoration columns (one mapping pass, no new research).
- Align `ICW_LICENSE_GATED_CATEGORIES` with `icw_category_gate()` — a small, contained fix.
- Replace or delete the mock `ICleanDashboard` so the `/iclean` route stops showing invented jobs.
- Add a simple admin list for `icw_candidate_leads` + a promote-to-worker action; this immediately unblocks 7 real applicants and gives the dispatch engine something to match against.
- Geocode the 27 ICW leads missing coordinates.
- Flip the five empty `ut_campaigns` off `active`, or surface their zero-lead state, so campaign status stops reading as "running".

## REAL BLOCKERS
1. **Licensing attorney review** of `icw_state_config` before any gated dispatch (owner + counsel).
2. **Booking/job source decision** for `icw-intake` (owner).
3. **ManyChat account + credential**, or an explicit decision to drop the IG/DM channel (owner).
4. **Make.com scenario** on the Playboxxx side — the webhook is ready and has received nothing (external).
5. **Recruiting lead supply** — every recruiting table is empty; no amount of code closes that.

## SMALLEST PATH TO COMPLETE ICW
Gate mapping → category reconciliation → candidate-review UI with promote-to-worker → seed real workers → real `icw-intake` persistence → geocode + map layers → worker notification/accept. Steps 1–4 are days of work and turn the existing engine from theoretical to exercised; steps 5–7 are what makes it an operating business.

## SMALLEST PATH TO COMPLETE RECRUITING
`recruiting_pipeline` table with the three-state switch → generalise `ut-growth-engine` to `business_leads` + `business` param → pre-flight sequencer (SMS/email/form; defer IG until ManyChat is resolved) → automatic activation gated on pre-flight → circuit breaker → hook health checks into the existing alert/heartbeat pattern. Do not build the onboarding kit until one non-UT business has actually run the loop end to end.

---
*No changes were made to code, data, migrations, permissions, automations, or outreach during this audit. No messages were sent.*
