# DYNASTY OS — PASS D MASTER
## Inbound · Email · Unified Inbox · Resilience

Audit date: 2026-08-02 · Method: repo read + live DB queries + live HTTP probes
Tagging: **[V]** verified · **[I]** inferred · **[U]** unknown

Supporting files: `D1_INBOUND_MAP.csv`, `D2_EMAIL_AUDIT.md`, `D3_INBOX_GAP.md`,
`D4_RESILIENCE_FINDINGS.md`.

---

## 1. HEADLINE

**Outbound has 99 dispatchers; inbound has one real path and it is a single
`<Dial>` to a Bland number resolved through a database view that does not exist.**

`twilio-inbound-call` and `dc-inbound-call` — which together serve **26 of the 27
provisioned Twilio numbers** — both begin by querying `v_phone_directory`.
`select to_regclass('public.v_phone_directory')` returns NULL [V]. The view has
never existed. Every inbound call therefore skips table-driven routing and falls
through to a per-brand environment variable. If that env var is set, the caller is
dialed to Bland with no IVR, no hours check, no queue, and no human fallback. If it
is not, the caller hears *"This line is not yet configured"* and is hung up on.

Three things follow from that, and they are the whole audit:

1. **Brandaro's product is inbound, and Brandaro's inbound is the degraded path.**
   All 15 Brandaro numbers route through the broken-view handler [V].
2. **The receptionist product that is *supposed* to answer those calls has zero
   customers and has never taken a call** — `brandaro_receptionist_clients` = 0 rows,
   `brandaro_receptionist_calls` = 0 rows [V]. The Retell provisioning
   (`brandaro-provision-receptionist`), the Stripe webhook, and the call webhook are
   all written and coherent. Nothing has ever run through them.
3. **When inbound does land, nobody is told and nobody works it.**
   `brandaro_inbound_messages`: 47 rows, **0 resolved, 0 auto-responded**, all from
   2026-06-06/07 [V]. `brandaro_pending_messages`: **2,706 pending, 6 sent** [V].

---

## 2. SCORECARD

| Area | Grade | One-line justification |
|---|---|---|
| Inbound voice | **D** | 26/27 numbers depend on a missing view; single `<Dial>`, no IVR/hours/queue; only GasMask has voicemail + recovery |
| Inbound SMS | **C** | Signature-verified handlers exist and 606 inbound rows landed, but 3 Messaging Services drop inbound outright and 1 number posts to a foreign project |
| Email | **F** | Two unrelated providers, no log table, no bounce webhook, 1-row suppression list, **no inbound email at all** |
| Unified inbox | **C-** | Real page over `communication_logs` only — hard `limit(200)`, no dc_call_logs/voicemail/Brandaro union, no assignment, no notification |
| Voicemail | **D** | Handler + transcription written and signature-verified; `voicemails` table has **0 rows** — the inbox page shows an empty list |
| Callbacks | **F** | `brandaro_callbacks` exists with `assigned_va`/`scheduled_time` and is **empty**; no scheduler, no reminder |
| Resilience | **B-** | `comms-health-monitor` is genuinely excellent — 6 layers, 20-min cron, synthetic probes. It alerts nobody. 58 feature_mode + 30 webhook_config failures currently open |
| Access control | **C** | Inbound webhooks all 403 unsigned (9/9 verified). Outbound send functions are not role-gated |
| Testing | **D** | Synthetic health loop honored (`SMhealth…` / `+15005550006`), but no sandbox mode for placing a test call and zero tests on comms functions |

---

## 3. THE 27-NUMBER PICTURE [V]

| Bucket | Count | State |
|---|---|---|
| Brandaro | 15 | all DEGRADED (missing-view fallback) |
| GasMask | 2 | WORKING — only brand with voicemail + missed-call SMS recovery |
| iClean / Surplus / TopTier | 3 | env-var dependent, 2 unverified |
| Marked inactive in `dc_phone_numbers`, webhook still live | 3 | ORPHAN — they will ring and route |
| No directory row at all | 3 | UNOWNED |
| Pointing at a foreign Supabase project | 1 | BROKEN (`+18883022514`) |

Full detail in `D1_INBOUND_MAP.csv`.

**Correction to a monitor claim:** `comms-health-monitor` reports `dc-inbound-call`
as *"not currently deployed; inbound would 404"* against 17 numbers. Direct probe
returns **403** (Twilio signature rejection) — the function is deployed and
healthy [V]. That check is a false positive and should be fixed before anyone acts
on it.

---

## 4. WHAT ACTUALLY WORKS (worth protecting)

- **`comms-health-monitor`** — six-layer, cron'd, synthetic-probe-aware. Best
  engineering in the comms stack. Only missing an alert sink.
- **Signature verification** — 9/9 inbound handlers reject unsigned POSTs [V].
- **`gasmask-missed-call-handler`** — real missed-call recovery: auto text-back,
  voicemail, DB log. It is gated to `business === 'gasmask'` and is the pattern
  every other brand should inherit.
- **`usePhoneLog.ts`** — clean counterparty-threaded call+SMS timeline. The right
  primitive; just needs to be widened and lifted into the inbox.
- **STOP/START handling** — implemented with regex in `brandaro-handle-inbound`,
  `sms-inbound-webhook`, `twilio-sms-webhook` [V]. The gap is that not every
  sending number's webhook points at one of those three.

---

## 5. REMEDIATION — ORDERED, WITH EFFORT

### P0 — do this week
| # | Fix | Why | Effort |
|---|---|---|---|
| 1 | **Create `v_phone_directory`** (or repoint both handlers at `dc_phone_numbers`) | Restores table-driven inbound routing for 26/27 numbers in one change | S |
| 2 | **Fix `+18883022514`** — repoint voice + SMS off the foreign project | Calls and texts currently leave the estate | S |
| 3 | **Set `inbound_request_url` on the 3 Messaging Services** | Inbound SMS is being dropped silently today | S |
| 4 | **Alert sink for `comms_health_checks`** — Slack/email on any `fail` | 58 + 30 open failures nobody has been told about | S |
| 5 | **Triage the 9 dispatchers returning 502**, starting with `twilio-recording-callback` (affects all recorded calls) | Live broken outbound | M |

### P1 — this month
| # | Fix | Why | Effort |
|---|---|---|---|
| 6 | **Generalize `gasmask-missed-call-handler`** — drop the brand gate, drive from `voice_routing_settings` | Every brand gets voicemail + text-back recovery | M |
| 7 | **Widen `useUnifiedInbox`** to union `dc_call_logs` + `brandaro_inbound_messages` + `voicemails`; remove the `limit(200)` in favor of pagination | Two of three inbound channels are currently invisible | M |
| 8 | **Notify on inbound arrival** (push/Slack) + `first_response_at` column | Nothing alerts a human today; 47 messages sat 8 weeks | M |
| 9 | **Reconcile the 3 ORPHAN + 3 UNOWNED numbers** — assign or release | Live numbers with no owner | S |
| 10 | **Fix the `function_deployment` false positive** in the monitor | Prevents the alert sink from crying wolf on day one | S |

### P2 — next quarter
| # | Fix | Why | Effort |
|---|---|---|---|
| 11 | **One email sender path** — retire Gmail SMTP, standardize on one domain, add `email_send_log` | Two providers, no log, no bounce handling | L |
| 12 | **Resend bounce/complaint webhook → suppression**, and join email suppression to `_shared/dnc.ts` `isSuppressed()` | 1-row suppression list, phone and email gates unconnected | M |
| 13 | **Inbound email** — MX/parse webhook into the same inbox | Email replies are lost today | L |
| 14 | **IVR / business-hours / queue layer** on inbound voice | Currently a bare `<Dial>` with a hangup fallback | L |
| 15 | **`TEST_MODE` on outbound dial + tests on comms functions** | No way to test without dialing a real number | M |

---

## 6. THE THREE THINGS THAT MATTER

1. **Create the missing view.** One object unblocks inbound routing for the whole
   estate. Everything else in P0 is a webhook string.
2. **Point the health monitor at a human.** The detection layer is already built
   and has been right for weeks; it is shouting into a table.
3. **Decide whether the receptionist product is real.** The full Retell + Stripe +
   webhook stack is written and has zero customers and zero calls. Either put a
   customer through it or stop counting it as shipped.
