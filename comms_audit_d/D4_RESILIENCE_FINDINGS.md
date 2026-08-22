# D4 — RESILIENCE & OPERATIONS (Pass D)

## HEALTH

### comms-health-monitor — the strongest asset in the comms stack [V]
`supabase/functions/comms-health-monitor/index.ts`. Cron every 20 min,
`verify_jwt=false`, live probe returns HTTP 200. Six layers, one row per
(layer, target) into `public.comms_health_checks`:
`credentials`, `webhook_config`, `function_deployment`, `a2p_sending`,
`signature_verify`, `synthetic_loop`, plus a `feature_mode` layer.

**Latest 2-hour window** [V]:
| layer | pass | warn | fail |
|---|---|---|---|
| feature_mode | 302 | 60 | **58** |
| webhook_config | 216 | 120 | **30** |
| a2p_sending | 72 | 90 | 0 |
| credentials | 66 | 96 | 0 |
| function_deployment | 33 | 0 | **3** |
| signature_verify | 12 | 0 | 0 |
| synthetic_loop | 6 | 6 | 0 |

**Who is alerted: nobody** [V]. It writes rows. There is no alert sink — no
Slack, no email, no push. The monitor has been correctly detecting a wall of
502s for weeks and no human was told.

> **Amended 2026-08-21 — this paragraph is no longer true.** As of 2026-08-20
> `comms-health-monitor` is wired to `sendOpsAlert()` (6h dedupe per target);
> a red check now leaves the database. Same day, the `function_deployment`
> layer was fixed to treat HTTP 403 as healthy (`probeDeployed()`), so
> signature-verified webhooks no longer report as "not deployed". Left here
> because this is a dated audit snapshot — current state lives in
> `docs/comms/OPEN-WORK-2026-08-20.md` item 5.

### Current live failures (last 2h, verbatim)
1. **Nine outbound call dispatchers return HTTP 502 (handler crashed)** [V]:
   `ambassador-ai-call`, `bland-start-call`, `brandaro-ai-caller`,
   `bulk-ai-call-processor`, `twilio-recording-callback`, `cold-call-tts-blast`,
   `dc-outbound-call`, and more — `feature_mode` targets marked `BROKEN`.
   *Call recording is among them:* "twilio-recording-callback … Affects: All
   recorded calls."
2. **Three Bland webhooks 502**: `bland-webhook`, `bland-call-webhook`,
   `bland-agent-webhook` [V]. Independently confirmed by direct probe:
   `bland-webhook` → HTTP 400 with no valid handler contract.
3. **`+18883022514` points at a foreign Supabase project**
   (`clrgkreqqgmycrskcmwq.supabase.co/functions/v1/twilio-twiml` for voice and
   `/messaging-inbound` for SMS) [V]. Both flagged `fail` (12200 class). Voice
   **and** SMS to this number leave the estate entirely.
4. **Three Messaging Services have `inbound_request_url` EMPTY with
   `use_inbound_webhook_on_number=false`** — monitor message: *"inbound will be
   dropped"* [V]. Created 2026-06-24. Any inbound SMS landing on those services
   is discarded silently.

> **Amended 2026-08-22 — closed, and already stale when this snapshot was
> written.** The June trio's empty-URL defect was fixed **2026-07-31 ~15:00
> UTC** (Playboxxx quarantine session): monitor history shows the same three
> SIDs `fail` at 14:40 and pointed/renamed at 15:00. Drop window: **2026-06-24
> → 2026-07-31, 37 days, closed.** Keep the signature of this failure class:
> inbound SMS in `communication_logs` fell **510 (June) → 6 (July)** while
> outbound held steady (396 → 403) — that divergence is how you spot
> silent-dropped inbound next time. The `MS:Unforgettable Times` row that
> resembles this finding is a **fourth** service (`MGcb31bd…`), first seen
> 2026-08-15, pointing at UT Platform (`pxylmrmwqmxotqffejbe`) — deliberate:
> handler probed and answering, same-day four-STOP bring-up test against
> +19294990837. `comms-health-monitor` now treats that destination as
> intentional so it stops warning on a correct configuration. Detail:
> `docs/comms/ITEMS-3-4-5-REPORT-2026-08-20.md`. One inference remains
> unproven: which service actually *holds* +19294990837 (one Twilio
> `Services/{sid}/PhoneNumbers` call — scheduled, not yet run).

### False positive worth knowing
The monitor reports `dc-inbound-call` as *"Supabase function not currently
deployed; inbound would 404"* on 17 numbers [V]. **This is wrong.** Direct probe:
`dc-inbound-call` → HTTP 403 (signature rejection), i.e. deployed and reachable
[V]. The `function_deployment` probe used by the `webhook_config` layer
mis-classifies alternate-route handlers. Fix the check, not the numbers.

### Per-number spam-flag / answer-rate tracking
Columns exist and are wired for calls: `dc_phone_numbers.risk_score`,
`answer_rate`, `total_calls`, `total_answered`, `daily_call_count`,
`daily_call_cap`, `warming_until`, `warming_daily_cap`, `cooldown_seconds`,
`bland_registered` [V]. No equivalent for SMS delivery rate. No carrier
spam-flag/label lookup anywhere [V]. `brandaro_number_alerts` exists as a table.

### Alert when a number stops working
No [V]. Detection exists (`comms_health_checks`), notification does not.

## FAILURE MODES

- **Bland down → no fallback** [V]. `twilio-inbound-call:139-144` dials the Bland
  DID inside `<Dial timeout="20">`; the only fallback is
  `<Say>We were unable to connect your call</Say><Hangup/>`. No human ring-through,
  no queue, no voicemail — except on the GasMask path.
- **Twilio errors → no retry, no DLQ** on the inbound side [V]. `email_jobs` has an
  `attempts`/`last_error` retry column (`dd-process-email-jobs`) — telephony has no
  equivalent.
- **Provider errors are surfaced only into `comms_health_checks`** [V], which no UI
  alerts on. `dc_call_logs` inserts are fire-and-forget with the error only
  `console.error`'d (`twilio-inbound-call:120-127`).

## TESTING

- **Synthetic probe path exists and is respected** [V]: `gasmask-sms-inbound`
  short-circuits on `MessageSid` starting `SMhealth…` from Twilio magic number
  `+15005550006`, ACKing with no side effects. `comms-health-monitor` also has a
  `synthetic_loop` layer (pass 6 / warn 6 in the last window).
- **No general test/sandbox mode for placing a call.** There is no
  `TEST_MODE`/`DRY_RUN` guard on the outbound dial path — a developer cannot place
  a test call without dialing a real number [V].
- **No automated tests covering comms paths** — no test files under
  `supabase/functions/**` for any telephony or messaging function [V].

## ACCESS CONTROL

- Inbound webhooks are correctly hardened: `verifyTwilio()` on
  `twilio-inbound-call`, `dc-inbound-call`, `gasmask-inbound-voice`,
  `twilio-sms-webhook`, `sms-inbound-webhook`, `gasmask-sms-inbound`,
  `voicemail-webhook`, `gasmask-missed-call-handler`, `brandaro-handle-inbound`.
  All nine return **403** on an unsigned probe [V].
- **Sending is not role-gated at the function boundary** [V]. Pass A already
  established 93 of 99 dispatchers bypass the suppression gate; the same functions
  do no role check either. A VA with a session token can invoke a send function for
  any brand — number selection is by argument, not by the caller's identity.
- **Audit trail is partial**: `communication_logs.performed_by` / `created_by` are
  populated by `src/services/communicationLogger.ts:37-42`, but the edge-function
  senders that bypass that service write no actor [V].
