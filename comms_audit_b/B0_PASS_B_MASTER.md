# DYNASTY OS — PASS B: REACHABILITY & MIGRATION SCOPE

Read-only audit. Nothing was changed. Tags: **[VERIFIED]** = read from code/DB this pass. **[INFERRED]** = deduced from strong but indirect evidence. **[UNKNOWN]** = could not determine with available access.

Census reused from Pass A (`comms_audit/01_SURFACE_INVENTORY.csv`, 99 dispatchers). Extended, not re-enumerated, into `01_SURFACE_INVENTORY_v2.csv`.

---

## HEADLINE

| Metric | Count |
| --- | --- |
| Dispatchers in census | 99 |
| **Reachable / live** (has at least one confirmed trigger) | **75** |
| Not reachable by any found trigger | 24 |
| Already compliance-gated | 6 |
| **GATE-NOW (P0 migration scope)** | **31** |
| GATE-LATER | 44 |
| KEEP-AS-IS (read-only or owner-only alerting) | 13 |
| FREEZE | 1 |
| DELETE-CANDIDATE (blocked on Make.com verification) | 4 |
| **Broken dependencies — reference tables that do not exist** | **5 functions** |

The real migration scope is **31 functions, not 93.** Pass A counted every ungated dispatcher. Pass B removes the 13 that physically cannot reach a consumer, the 6 already gated, the 5 that are dead or broken, and defers 44 low/zero-volume paths.

---

## PHASE 1 — REACHABILITY

### 1. UI reference [VERIFIED]
`src/` scanned for `functions.invoke("<name>")` and `functions/v1/<name>`. 64 dispatchers have at least one `src/` call site. Recorded per row in `trigger_ui`.

### 2. Scheduled [VERIFIED]
`cron.job` read directly. 244 cron entries total; 34 resolve to edge functions. Cron-triggered dispatchers confirmed this pass include:

`brandaro-send-followup`, `brandaro-send-followups`, `brandaro-recovery-worker`, `comms-health-monitor`, `system-health-runner`, `dd-cart-recovery-cron`, `dd-generate-partner-payouts`, `dd-subscription-fulfillment`, `dd-supplier-scorecard`, `solar-followup-sender`, `monitor-ut-ambassador-pipeline`, `tt-release-expired-auths`, `re-trigger-bland-campaign`, `sf-lead-import`, `bulk-sms-processor`, `bulk-ai-call-processor`.

**These fire with no human in the loop.** Every one of them is in GATE-NOW or GATE-LATER — none are gated today.

### 3. Provider webhook [VERIFIED where DB/provider-config was readable]
- Stripe → `brandaro-stripe-webhook`, `dd-stripe-webhook`
- Retell → `brandaro-retell-webhook`
- Twilio inbound → `twilio-sms-webhook`, `twilio-voice-webhook`, `twilio-inbound-call`, `dc-inbound-call`, `brandaro-handle-inbound` (Pass D mapped 27 numbers)
- Bland → `bland-agent-webhook`, `dc-bland-webhook`
- External site POST → `receive-event-booking`, `dynasty-recovery-claimant-intake`, `ambassador-sale-webhook`

### 4. Called by another edge function [VERIFIED]
48 cross-function invocation edges found. Full graph in `02_TRACE_MAP.md`. Notable: every `*-trigger-bland-campaign` fans into `dc-bland-webhook`; `send-sms` is the only shared SMS chokepoint and only 4 functions actually use it — the other 60+ call `api.twilio.com/.../Messages.json` directly.

### 5. Make.com / external automation **[UNKNOWN]**
No Make.com credentials or scenario export available in this environment. No dispatcher can be cleared of external invocation. **Every deletion candidate below is therefore flagged `[UNKNOWN-MAKE]` and held back from deletion**, per the safety rule.

### 6. Database trigger / RPC [VERIFIED]
`pg_proc` scanned for `net.http_post`. Only two functions post to HTTP from the database: `notify_clipper_approved` and `trigger_dd_auto_price`. Neither targets a dispatcher in the census. No dispatcher is invoked by a DB trigger.

### Execution evidence [VERIFIED]
Each dispatcher was mapped to the tables it `INSERT`s into (static parse of `.from(x).insert`), then those tables were counted for the last 90 days. Results in `row_count_90d` / `last_activity`.

Live sinks with real recent traffic:

| Table | rows 90d | total | last write |
| --- | --- | --- | --- |
| `dynasty_ai_calls` | 7,654 | 7,654 | 2026-07-31 |
| `bland_call_logs` | 3,549 | 3,551 | 2026-07-22 |
| `surplus_funds_leads` | 4,242 | 4,242 | 2026-07-27 |
| `communication_logs` | 1,431 | 1,534 | 2026-07-29 |
| `dc_leads` | 996 | 996 | 2026-07-15 |
| `outbound_messages` | 822 | 849 | 2026-07-29 |
| `brandaro_ai_calls` | 277 | 277 | 2026-07-30 |
| `re_automation_log` | 118 | 118 | 2026-07-27 |
| `sbo_sms_log` | 87 | 108 | 2026-07-22 |
| `dc_call_logs` | 81 | 103 | 2026-07-29 |

Dead sinks (0 rows ever): `brandaro_call_logs`, `brandaro_message_log`, `brandaro_execution_log`, `brandaro_automation_log`, `brandaro_job_failures`, `brandaro_lead_memory`, `brandaro_closer_alerts`, `brandaro_contact_limits`, `brandaro_call_patterns`, `ut_outreach_log`, `ut_supplier_messages`, `ut_pub_referrals`, `solar_interactions`, `cold_call_campaigns`, `cold_call_items`, all 6 `cb_*` tables, all 3 `tt_booking_events`/`tt_broadcast_quotes`/`tt_confirmation_requests`, `ambassador_activity_log`.

**Caveat [INFERRED]:** a zero-row log table does not prove the function never sent. It proves the function never successfully logged. Several dispatchers send via `api.twilio.com` first and log after — a send followed by a failed insert leaves no trace. Sends are only provably countable for the 6 gated paths and anything writing `communication_logs`.

---

## NEW FINDING — 5 DISPATCHERS REFERENCE TABLES THAT DO NOT EXIST [VERIFIED]

Every table name referenced by any dispatcher was checked against `to_regclass`. Six do not exist:

| Function | Missing table(s) | Consequence |
| --- | --- | --- |
| `tt-auto-dispatch` | `partners`, `tt_service_partners`, `vehicles` | Cannot resolve a dispatch target. Hard-fails. |
| `tt-smart-dispatch` | `partners` | Partner ranking query throws. |
| `solar-followup-sender` | `solar_master_leads` | **Cron-scheduled.** Fires on schedule and errors every run. |
| `playboxxx-trigger-bland-campaign` | `playboxxx_leads` | Cannot load leads. |
| `ambassador-sale-webhook` | `ambassador_sales` | Webhook-reachable, insert always fails. |

`solar-followup-sender` is the worst of these: it is on cron, so it is generating a silent recurring failure that nobody sees (consistent with Pass D's finding that `comms-health-monitor` alerts nobody).

---

## PHASE 3 — DISPOSITION

### ALREADY-GATED (6)
`send-sms`, `twilio-outbound-call`, `dc-bland-dispatch`, `dd-trigger-bland-campaign`, `tt-trigger-bland-campaign`, `ut-trigger-bland-campaign`.
These carry the UT-025 `isSuppressed()` gate or the `gasmask-dnc-write` path. Nothing to do.

### GATE-NOW — 31, the real P0 scope
Live trigger **and** meaningful volume **and** reaches a non-owner number.

| Group | Functions |
| --- | --- |
| **G0 shared transport libs** (2) | `_shared/twilio-operator.ts`, `_shared/gasmaskVoice.ts` |
| **G1 bland campaign triggers** (2) | `re-trigger-bland-campaign`, `sf-trigger-bland-campaign` |
| **G2 bland direct** (4) | `bland-start-call`, `bulk-ai-call-processor`, `ambassador-ai-call`, `brandaro-ai-caller` |
| **G3 outbound voice (twilio)** (4) | `gasmask-ai-caller`, `ambassador-direct-call`, `brandaro-closer-action`, `field-portal-comms` |
| **G4 generic SMS senders** (8) | `bulk-sms-processor`, `messaging-send-worker`, `send-invoice-sms`, `va-send-intake-invite`, `sf-lead-import`, `dynasty-recovery-claimant-intake`, `gasmask-missed-call-handler`, `monitor-ut-ambassador-pipeline` |
| **G5 toptier** (1) | `tt-smart-dispatch` |
| **G6 dynasty direct** (1) | `dd-subscription-fulfillment` |
| **G7 brandaro** (5) | `brandaro-send-followup`, `brandaro-send-followups`, `brandaro-sms-dispatch`, `brandaro-recovery-worker`, `brandaro-handle-inbound` |
| **G8 ambassador / UT** (2) | `ambassador-send-sms`, `ut-growth-engine` |
| **G9 SBO** (2) | `sbo-send-daily-sms`, `sbo-daily-automation` |

**G0 is the highest-leverage item in this entire audit.** `_shared/twilio-operator.ts` and `_shared/gasmaskVoice.ts` are the transport used by the inbound webhook handlers and the operator send paths. Gating inside those two files covers their importers without touching the importers.

### GATE-LATER (44)
Live or webhook-reachable but low/zero recent volume, or notification-only to a known counterparty (partner/driver/supplier rather than a cold prospect). Full list in the CSV. Includes `tt-*` fulfillment notifications, `dd-*` order notifications, `solar-*` dialers, `cb-dispatch-engine`, `supplier-send`, `nightlife-notify`, `cold-call-tts-blast`, `place-outbound-call`, `transfer-campaign-call`, `twilio-manual-call`, `va-initiate-call`.

Two of these deserve promotion the moment their vertical is switched on: `cold-call-tts-blast` and `solar-parallel-dialer` are cold-outreach dialers with zero gate — they are only GATE-LATER because they are currently idle.

### KEEP-AS-IS (13)
Cannot reach a consumer.
- Read-only, GET only: `fetch-twilio-messages`, `fetch-twilio-conversation`, `discover-twiml-apps`, `sync-bland-call`
- Owner-number-only alerting [VERIFIED by literal in source]: `tt-deliverability-test` (`To: "+19174643048"`, index.ts:19), `encrypt-client-ssn` (`davidPhone`, index.ts:118), `dropship-product-scorer` (`DAVID_PHONE_NUMBER`, index.ts:296), `check-bill-balances` (`ADMIN_PHONE_NUMBER`, index.ts:63)
- Probes/tests: `comms-health-monitor`, `system-health-runner`, `comms-loop-probe`, `admin-twilio-test`, `test-ring`

Note: `encrypt-client-ssn`, `dropship-product-scorer` and `check-bill-balances` were counted as ungated dispatchers in Pass A. They are not outreach — they are owner alerts. Pass A over-counted by these.

### FREEZE (1)
`playboxxx-trigger-bland-campaign` — SHAFT-adjacent vertical, on the Bland campaign path, and depends on a table that does not exist. Should be disabled rather than gated.

### DELETE-CANDIDATE (4) — **held back, not deletable yet**
`dd-notify-question`, `dialer-bridge-agent`, `tt-nightly-report`, `ut-track-ambassador-sale`.
No UI reference, no cron, no webhook, no cross-function caller, no log rows ever. **All four are flagged `[UNKNOWN-MAKE]`** — Make.com could not be checked, so none may be deleted until someone confirms no scenario calls them.

---

## PHASE 4 — MIGRATION SCOPE SUMMARY

**What has to be gated: 31 functions, reducible to roughly 12 edit sites.**

The reduction comes from three consolidations:

1. **G0 — 2 shared libs cover 9 importers.** Gate inside `_shared/twilio-operator.ts` and `_shared/gasmaskVoice.ts` and you cover `twilio-voice-webhook`, `twilio-sms-webhook`, `initiate-operator-call`, `send-operator-sms`, and the 5 `gasmask-*` handlers for free.
2. **G1 — 4 brand triggers are the same file with a different table name.** `re-`, `sf-`, `dd-`, `tt-`, `ut-`, `playboxxx-` `-trigger-bland-campaign` are near-identical; 3 already carry the gate. Copying it into the remaining 2 is mechanical.
3. **G4 — 8 generic senders share one shape:** build a `To`, POST to `Messages.json`. They should be converted to call the already-gated `send-sms` instead of hitting Twilio directly. That is the single largest structural win available: it collapses 8 ungated egress points into 1 gated one, and it is the same change that would eventually absorb most of GATE-LATER.

**Recommended P0 order:**

1. `_shared/twilio-operator.ts` + `_shared/gasmaskVoice.ts` (2 files, 9 functions covered)
2. `re-trigger-bland-campaign` + `sf-trigger-bland-campaign` (copy existing gate, 2 files)
3. G2 Bland direct — `bland-start-call` first; it backs `bland_call_logs` (3,549 rows/90d, highest-volume voice path in the system)
4. G4 — route through `send-sms` rather than gating each in place
5. G7 Brandaro cron followups — unattended, currently ungated
6. G3, G5, G6, G8, G9

**Out of P0:** the 44 GATE-LATER, the 13 KEEP-AS-IS, the 1 FREEZE, and the 4 DELETE-CANDIDATE.

**Blocking unknowns:**
- Make.com scenario inventory `[UNKNOWN]` — blocks all 4 deletions and could promote any GATE-LATER to GATE-NOW.
- Whether zero-row log tables mean "never sent" or "sent and failed to log" `[UNKNOWN]` — only resolvable by reading Twilio's own message log, which was not done in this pass.
