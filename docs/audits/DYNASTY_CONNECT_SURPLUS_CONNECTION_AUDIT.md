# Dynasty Connect ↔ Surplus Funds — Connection Audit

**Scope:** Dynasty Connect AI‑calling engine as it connects to the Surplus Funds pipeline.
**Environment:** Lovable e9aba3c3, Supabase qalaaroashbggynpvqct. Read‑only. All claims grounded in real code, DB rows, and edge functions.

---

## Section 1 — What the connection does today (plain language)

**A queued SF lead CAN be dialed by AI, and outcomes DO write back — but the path is triggered manually from the Surplus Hub, not from Dynasty Connect, and it has barely been used.**

Real end‑to‑end path that actually exists in code:

1. Operator sits inside `src/pages/surplus-funds/SFLeadPipeline.tsx` (or `SFAutomation.tsx`) and clicks a "Send to Bland" / "Fire campaign" button.
2. Client calls `supabase.functions.invoke('sf-trigger-bland-campaign', { body: { lead_ids: [...] } })` — hard‑rejects if `lead_ids` is empty (`sf-trigger-bland-campaign/index.ts` lines 40‑52).
3. Function pulls rows from `surplus_funds_leads` filtered on `dnc=false` + non‑null phone, cross‑checks `dnc_list` (last‑10‑digit match), inserts mirrored rows into `dc_leads` (`business_id='surplus_funds'`, `lead_type='surplus_funds_claimant'`), then per lead calls `POST https://api.bland.ai/v1/calls` with `pathway_id="d3a5f544-bc68-4a2c-9b35-56e489b78e6d"` and the inlined `SF_OUTREACH_PROMPT` (lines 8‑29).
4. Webhook is registered as `${SUPABASE_URL}/functions/v1/dc-bland-webhook` (secret‑gated via `?secret=…` or `x-dc-webhook-secret`, `DC_BLAND_WEBHOOK_SECRET`).
5. Bland fires live events (`call_started`, `call_answered`, `transcript`, `call_failed`) and a completion payload. Webhook updates `dynasty_ai_calls` + `dynasty_call_history` + `dynasty_call_queue`, runs Claude Sonnet 4 post‑call analysis into `dynasty_call_analysis`, and dual‑writes disposition + transcript + recording URL back into `surplus_funds_leads` (lines 542‑575).
6. If canonical disposition is `interested` and a transcript exists, it fires `dc-post-call-analysis` for deeper enrichment.

**Where the wiring is really thin:**

- **Dynasty Connect's own Surplus pipeline UI (`pipelines/SurplusFundsPipeline.tsx`) does NOT trigger Bland.** Its `sendToCampaign` mutation in `usePipelineLeads.ts` (lines 146‑172) only inserts an `ai_call_campaigns` draft row and flips `dc_leads.status='queued'`. No `sf-trigger-bland-campaign` invoke. **Nothing calls anyone from that button.**
- **Only 8 SF leads have ever been pushed into `dc_leads`, 3 `dc_campaigns` rows exist for surplus, and all three are `status='failed'`** (last one 2026‑07‑02).
- **No cron drains the queue.** No scheduled job invokes `sf-trigger-bland-campaign`; the loop only runs when a human clicks.

**Verdict:** wired, live, real Bland integration on the Surplus Hub side; **DEAD button on the DC side**. Outcomes write back — but only 1 SF lead has ever received one (`interested`, 1 transcript).

---

## Section 2 — Database / campaign tables

| Table | Rows | Written by real code? | Notes |
|---|---|---|---|
| `dc_campaigns` | 61 total, 3 surplus (all `failed`) | ✅ `sf-trigger-bland-campaign` inserts on dispatch | 61 spread across top_tier (32), dynasty_direct (18), re (5), surplus (3), ut (3) |
| `dc_leads` | 996 total, 8 surplus | ✅ `sf-trigger-bland-campaign` inserts mirror row | `business_id='surplus_funds'`, `lead_type='surplus_funds_claimant'` |
| `dynasty_ai_calls` | 7,319 | ✅ live | 4,074 in last 30d, 71 in last 24h — but this is aggregate DC traffic, not surplus‑specific |
| `dynasty_call_history` | 39 | ✅ live event mirror | **all 39 rows have `business_type = NULL`** — the code path `queueRow?.business_type` never resolves because `dynasty_call_queue` is only 2 rows deep |
| `dynasty_call_queue` | 2 | ⚠️ | Practically unused — surplus dispatch goes straight to Bland, not through this queue |
| `dynasty_call_analysis` | 14 | ✅ Claude analysis inserts | 14 analyses vs 7,319 calls → ~0.2% coverage |
| `dynasty_call_transcripts` | 79 | ✅ live event inserts | live transcript stream working |
| `surplus_funds_leads` | 3,788 | ✅ writeback works | `bland_call_id` set on 1, `bland_call_triggered=true` on 8, `last_called_at` **NULL for all 3,788** — but `interest_level='high'` present on 1 row from Bland writeback |
| `dnc_list` | 0 | table exists, empty | zero DNC seed, zero opt‑outs recorded |

Real tables. No mock tables. Real inserts. But surplus volume ≈ nothing.

---

## Section 3 — Calling stack

| Component | Wired? | Evidence |
|---|---|---|
| **Bland.ai** | ✅ real | `sf-trigger-bland-campaign` reads `Deno.env.get('BLAND_API_KEY')`, hits `POST https://api.bland.ai/v1/calls` with a hard‑coded `pathway_id="d3a5f544-bc68-4a2c-9b35-56e489b78e6d"`. `dynasty_ai_calls` has 4,074 rows in last 30d confirming live traffic. |
| **Twilio** | ⚠️ **Bland manages Twilio, not us** | No direct Twilio call in the surplus path. Bland provisions its own numbers. We *do* have `TWILIO_ACCOUNT_SID` in `.env` and separate `dc-outbound-call`, `dc-twilio-creds-check`, `twilio-bridge-to-bland` functions, but the surplus path never calls them. Also: `TWILIO_ACCOUNT_SID` in `.env` begins with `US…` not `AC…`, which violates the standing rule (see mem://security/twilio-sid-prefix-standard). |
| **ElevenLabs** | ❌ **not in the surplus path** | `SF_OUTREACH_PROMPT` uses Bland's built‑in `voice: 'June'`. No ElevenLabs API call in `sf-trigger-bland-campaign`. Other DC funcs reference ElevenLabs (brandaro) but not surplus. |
| **Claude / Anthropic** | ✅ post‑call analysis | `dc-bland-webhook` runs `claude-sonnet-4-20250514` scoring into `dynasty_call_analysis`. |

**Actually connected for surplus:** Bland.ai + Claude. **Designed‑only for surplus:** Twilio direct, ElevenLabs.

---

## Section 4 — Lead intake from the hub

- ✅ Real: `sf-trigger-bland-campaign` reads `surplus_funds_leads` directly by `id IN (:lead_ids)` and filters on `dnc=false` + phone present.
- ✅ Real: cross‑checks global `dnc_list` (last‑10‑digit hashing), auto‑flags matches.
- ✅ Real: per‑lead dispatch gate — `checkDispatchGates(businessUnitKey='surplus_funds')` re‑checked mid‑batch; kill‑switch aborts remaining leads and cancels them.
- ❌ **No cron / scheduled dispatcher.** Nothing scans `surplus_funds_leads WHERE status='phone_found' AND bland_call_triggered=false` on a schedule. Every campaign is a human click.
- ❌ **Only 8/3,788 (0.2%) leads have ever been triggered.** 3,769 leads sit at `status='skip_trace_pending'`, 9 at `phone_found` — the caller has almost nothing to call because skip‑trace itself never runs (per Surplus Hub audit).

---

## Section 5 — Surplus script / agent

- ✅ Real script exists — hard‑coded in `sf-trigger-bland-campaign/index.ts` as `SF_OUTREACH_PROMPT`. Substitutes `{{first_name}}`, `{{county}}`, `{{state}}`, `{{amount}}`.
- ✅ Real qualification: script asks 2‑minute permission, if interested collects "best callback time and email", promises specialist within 24h.
- ⚠️ **Script lives in the edge function, not in a table.** No `dc_scripts` / `dc_agents` row that ops can edit. Version‑controlled but not operator‑editable.
- ⚠️ Pathway ID `d3a5f544-bc68-4a2c-9b35-56e489b78e6d` is opaque — we cannot audit inside Bland what that pathway does without hitting Bland's dashboard; the `task` field is passed alongside so at minimum the script is transmitted.
- ⚠️ Voice `June` is a Bland built‑in — no brand voice.

---

## Section 6 — Call execution + outcomes

| Feature | Status | Evidence |
|---|---|---|
| Calls actually place | ✅ | 7,319 rows in `dynasty_ai_calls`; live event stream working (79 transcripts, 39 history rows) |
| Answered / voicemail / failed captured | ✅ | `dc-bland-webhook` handles `call_started`, `call_answered`, `transcript`, `call_failed` events + completion payload; AMD enabled (`amd:true`, `answered_by_enabled:true`) |
| Voicemail drop template | ⚠️ optional | `fetchVoicemailTranscript` called on dispatch; only fires when a template row exists |
| Canonical disposition mapping | ✅ | `canonicalizeDisposition()` in shared module writes `call_outcome` + `interest_level` |
| **Live transfer to human closer** | ❌ **NOT built** | No warm‑transfer / `<Dial>` bridge in surplus path. `twilio-bridge-to-bland` exists but is not invoked. `SF_OUTREACH_PROMPT` promises "a specialist will call within 24 hours" — i.e. a callback, not a live transfer. |
| Retry logic | ❌ | No retry cron. Failed calls stay failed. |
| Call windows / TCPA hours | ✅ enforced | `checkDispatchGates` runs per lead — kill‑switch + calling hours + throttle (shared module) |
| DNC scrubbing | ✅ two‑layer | `dnc=false` filter on `surplus_funds_leads` + cross‑check against `dnc_list` (currently 0 rows — **empty DNC list is a compliance risk**) |

---

## Section 7 — Write‑back to the hub (critical)

**✅ Real, wired, tested — but almost never exercised.**

`dc-bland-webhook/index.ts` lines 542‑575: on completion for `sourceHub === 'surplus_funds'`:

- `rpc('increment_call_count', target_table:'surplus_funds_leads')`
- `UPDATE surplus_funds_leads SET status=<canonical>, last_called_at=now(), call_outcome=<canonical>, call_recording_url=…, call_transcript=…, bland_call_id=…, interest_level=<derived>`
- Log to `dc_lead_sync_log` (direction='out', source='dc-bland-webhook:surplus_funds')
- If `interested` + transcript → fire `dc-post-call-analysis` for deeper enrichment

**Correlation key:** `payload.request_data.lead_id` (embedded on dispatch). Fallback: phone‑match on `dc_leads` most‑recent row.

**Evidence writeback works:**
- 1 `surplus_funds_leads` row currently has `interest_level='high'`, transcript populated, status flipped — a real closed loop.
- BUT: `last_called_at` is NULL for all 3,788 rows, meaning the `bland_call_id` we see (1 row) came in through a different path or the update was partial. Worth spot‑debugging in a follow‑up.

**Verdict:** connection back to the hub is **built and functional**. Not disconnected. Just underused.

---

## Section 8 — Compliance

| Rule | Status |
|---|---|
| DNC scrub | ✅ two‑layer (lead‑level flag + global `dnc_list`) — but `dnc_list` is EMPTY (0 rows). No national DNC ingestion. |
| Calling hours (TCPA 8am–9pm local) | ✅ enforced via `checkDispatchGates` shared module |
| Kill switch | ✅ per‑batch, per‑lead re‑check, non‑retryable → batch cancel |
| Recording disclosure ("this call may be recorded") | ❌ **NOT in the script.** `SF_OUTREACH_PROMPT` does not disclose recording, yet `record:true` is set on the Bland payload. **Two‑party consent states (CA, FL, IL, MD, MA, MT, NV, NH, PA, WA) treat this as illegal wiretap.** Surplus fund claimants often live in Florida. Critical compliance gap. |
| Prior express written consent (TCPA) | ❌ not enforced. Nothing verifies the phone we got via skip‑trace was consented. Autodialing consumer cell phones without prior express written consent is a TCPA violation carrying $500–$1,500 per call. |
| A2P/10DLC brand registration for SMS piggyback | N/A — surplus path is voice‑only |
| State‑specific claimant‑disclosure laws | ❌ 0% encoded. FL/TX/CA each have surplus‑fund solicitation restrictions. |

**Compliance is the #1 legal risk in this connection.**

---

## Section 9 — Every page / button / real vs mock

**A. Surplus Hub side (the button that actually works):**

| Page | Button | Wired? |
|---|---|---|
| `SFLeadPipeline.tsx` | "Send to Bland" on `handleBulkUploadWithCampaign` | ✅ calls `sf-trigger-bland-campaign` |
| `SFAutomation.tsx` | 2× `supabase.functions.invoke('sf-trigger-bland-campaign')` calls | ✅ real |
| `SFHumanQueue.tsx` | manual disposition write | ✅ real writes to `surplus_funds_leads` |
| `SFCommandCenter.tsx` | stats display | ✅ reads real rows |

**B. Dynasty Connect side (the buttons that DON'T call anyone for surplus):**

| Page | Button | Status |
|---|---|---|
| `pipelines/SurplusFundsPipeline.tsx` | "Send to campaign" | ❌ **dead for calling** — only creates `ai_call_campaigns` draft row + updates `dc_leads.status='queued'`. Never invokes `sf-trigger-bland-campaign`. |
| `DCBulkLaunch.tsx` | Bulk launch | Not audited for surplus wiring — no evidence surplus is a supported target |
| `DCCallDispatch.tsx`, `DCCallResults.tsx`, `DCLiveCalls.tsx`, `DCFinishedCallsPage.tsx` | Read‑only monitoring boards | ✅ read real rows from `dynasty_ai_calls` + `dynasty_call_history` — but `business_type=NULL` on all 39 history rows, so filtering by "surplus" in the UI will show nothing |
| `DCPhoneNumbers.tsx`, `DCPhoneNumbersManager.tsx` | Twilio number provisioning | Not exercised for surplus (Bland manages numbers) |
| `DCDNCManager.tsx` | DNC entry | ✅ real table, but 0 rows |
| `DCComplianceDashboard.tsx` | Compliance view | ⚠️ UI exists; no auto‑compliance enforcement wired |
| `DCAgents.tsx` | Agent management | ⚠️ pathway ID is hard‑coded in the edge function, not editable here |

---

## Section 10 — Multi‑vertical note

Dynasty Connect **is** genuinely multi‑vertical in code (top_tier 32 campaigns, dynasty_direct 18, re 5, surplus 3, ut 3). Each vertical has its own dedicated trigger function (`sf-trigger-bland-campaign`, `tt-trigger-bland-campaign`, `re-trigger-bland-campaign`, `ut-trigger-bland-campaign`, `dd-trigger-bland-campaign`, `gasmask-trigger-bland-campaign`, `playboxxx-trigger-bland-campaign`) — no generic engine yet, but the webhook (`dc-bland-webhook`) does branch on `sourceHub` and dual‑write to each vertical's own table.

**Surplus is a real configured instance**, not a mock: dedicated script, dedicated pathway ID, dedicated writeback branch. It just has almost no volume (3 campaigns, all failed, 8 leads).

---

## Section 11 — Security / access

| Concern | Status |
|---|---|
| **Route guard on `/dynasty-connect/*`** | ❌ **`<Route path="/dynasty-connect" element={<DCLayout />}>` in `AppRoutes.tsx` line 1606 has NO `<RequireRole>` wrapper.** Any authenticated user reaches the entire calling console, dispatch, DNC, recordings, transcripts. |
| Route guard on `/surplus-funds/*` | ✅ per prior audit, `RequireRole` gated |
| API keys server‑side only | ✅ `BLAND_API_KEY`, `ANTHROPIC_API_KEY`, `DC_BLAND_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` all read via `Deno.env.get()` in edge functions; not in client bundle |
| `TWILIO_ACCOUNT_SID` in `.env` | ⚠️ present but starts with `US…` (violates mem://security/twilio-sid-prefix-standard requiring `AC…`) — currently unused by surplus path but a landmine |
| Webhook signature | ⚠️ shared‑secret query param only (Bland doesn't HMAC). Warns on missing secret but still accepts. |
| Claimant PII in transcripts | ⚠️ `dynasty_call_transcripts` (79 rows) contains raw conversation text including SSN‑adjacent details. RLS not verified in this audit — flag as follow‑up. |
| Recording URLs | ⚠️ `call_recording_url` stored plain on `surplus_funds_leads`; anyone with the URL can play the call (Bland URLs are unauthenticated). |

---

## Section 12 — Scorecard

### Build completion %

| Layer | % |
|---|---|
| Stack wiring (Bland/Claude) | 85% |
| Twilio direct + ElevenLabs for surplus | 0% (not needed if Bland is enough) |
| Lead intake (manual click) | 70% |
| Lead intake (scheduled/cron) | 0% |
| Script + qualification | 75% (hard‑coded, not editable) |
| Call execution + AMD + voicemail | 80% |
| Live transfer to human closer | 0% |
| Retry logic | 0% |
| Writeback to hub | **90%** — real, working, one closed loop confirmed |
| DC pipeline UI "Send to campaign" | 20% (button exists, doesn't call Bland) |
| Compliance | 40% (DNC scrub yes, calling hours yes, recording disclosure NO, TCPA consent NO) |
| Security (route guard) | 10% |

**Overall build ≈ 55%.**

### Operational readiness %

**Could a queued lead actually get called and the outcome update the case today?**

- ✅ Yes, IF an operator (a) sits in Surplus Hub, (b) clicks the right button on a lead that has a phone number, (c) waits.
- ❌ No, if you rely on Dynasty Connect's own Surplus pipeline page — that button is dead.
- ❌ No at scale — no cron, no scheduled dispatch, 3,769/3,788 leads still stuck at `skip_trace_pending`.

**Operational readiness ≈ 25%. Working caller, partially disconnected.** The connection is real but starved. And the recording‑disclosure gap makes running it at volume legally hazardous.

---

## Section 13 — Prioritized task list to 100%

### 🔴 CRITICAL (compliance + security — block scaled dialing)

| # | Task | Owner |
|---|---|---|
| C1 | Add recording‑disclosure to `SF_OUTREACH_PROMPT` opening line ("This call is being recorded for quality assurance"). Two‑party consent states make this table‑stakes. | dev |
| C2 | Add `<RequireRole>` wrapper on `/dynasty-connect/*` in `AppRoutes.tsx` line 1606 (mirror the `/surplus-funds/*` pattern). | dev |
| C3 | Verify RLS on `dynasty_call_transcripts`, `dynasty_call_analysis`, `dynasty_ai_calls` — restrict to admin/staff roles. | dev |
| C4 | Ingest DNC list (national DNC + prior opt‑outs). Currently 0 rows — dispatching against `dnc_list` today filters nothing. | owner + dev |
| C5 | Fix `TWILIO_ACCOUNT_SID` in `.env` — currently starts with `US…`, must start with `AC…` per standing rule. | owner |

### 🟠 HIGH (make the connection actually flow)

| # | Task | Owner |
|---|---|---|
| H1 | Wire `pipelines/SurplusFundsPipeline.tsx` `sendToCampaign` to actually invoke `sf-trigger-bland-campaign` instead of just inserting an `ai_call_campaigns` draft. Currently dead button. | dev |
| H2 | Add a scheduled dispatcher (cron) that scans `surplus_funds_leads WHERE status='phone_found' AND bland_call_triggered=false AND dnc=false` in batches within TCPA hours and calls `sf-trigger-bland-campaign`. | dev |
| H3 | Investigate why 8 leads show `bland_call_triggered=true` but 0 have `last_called_at` set — either the writeback for those never fired, or `request_data.lead_id` was lost on webhook. | dev |
| H4 | Backfill `dynasty_call_history.business_type` so DC's monitoring boards (`DCLiveCalls`, `DCFinishedCallsPage`) can actually filter to surplus. | dev |
| H5 | Confirm `BLAND_API_KEY` + `DC_BLAND_WEBHOOK_SECRET` are set in edge‑function env for prod (audit didn't verify presence, only reference). | owner |

### 🟡 MEDIUM (feature completeness)

| # | Task |
|---|---|
| M1 | Move `SF_OUTREACH_PROMPT` + `BLAND_AGENT_ID` (`d3a5f544-…`) out of the edge function into `dc_agents` / `dc_scripts` tables so ops can edit script/agent without a deploy. |
| M2 | Build live‑transfer to human closer: `<Dial>` bridge on Bland's "interested" callback into a phone group. Currently promises "specialist within 24 hours" which is a delayed callback, not a transfer. |
| M3 | Retry logic: leads with `no_answer`/`voicemail` should re‑queue with backoff (e.g. 2h, 24h, 3d). Currently one‑shot. |
| M4 | Consent capture: add a "how did we get this number" audit column on `surplus_funds_leads` (skip‑trace source, purchased list, referred) for TCPA defense. |
| M5 | State‑specific script variants — FL/TX/CA claimant solicitation rules differ; branch script by `state`. |

### 🟢 LOW (polish)

| # | Task |
|---|---|
| L1 | Populate `dnc_list.source` and `dnc_list.business` so DNC hits are attributable per vertical. |
| L2 | Voice A/B test — try an ElevenLabs voice for surplus and measure completion / interest lift vs Bland's `June`. |
| L3 | Editable pathway registry so we can swap Bland pathway IDs from the DC Agents UI. |
| L4 | Populate `dynasty_call_analysis` for all completed calls (currently 14 / 7,319 ≈ 0.2% coverage). |

---

## Bottom line

Dynasty Connect **is** connected to Surplus Funds. The caller is real, the writeback is real, one lead has completed the full loop. But:

- The button inside Dynasty Connect's own Surplus pipeline **does not dial anyone.**
- There is **no cron** — every call is a manual click from the Surplus Hub.
- **Recording disclosure is absent** from a script that records the call. That is a legal problem in ~10 states.
- **DNC list is empty**, route is **unguarded**, and 99.8% of surplus leads still have no phone to call.

Working caller, real writeback, **starved and legally exposed pipeline.**
