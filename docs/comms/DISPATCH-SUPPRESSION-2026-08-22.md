# TopTier dispatch → send-sms conversion + suppression visibility

**Date:** 2026-08-22
**Status:** shipped

## What changed

All six `tt-*` dispatch functions were converted off direct
`api.twilio.com/.../Messages.json` POSTs and onto the shared helpers. Zero
direct Twilio posts remain under `supabase/functions/tt-*/`.

| Function | Audience | Class | Helper |
|---|---|---|---|
| `tt-smart-dispatch` (main + legacy loops) | contracted partners | `workforce` | `_shared/sendSms.ts` → `send-sms` |
| `tt-auto-dispatch` — partner sends (backup, vehicle-direct, category fallback, dispatch-request) | partners | `workforce` | `sendSms` |
| `tt-auto-dispatch` — David alerts (6 sites) | internal operator | `internal` | `_shared/twilioSend.ts` |
| `tt-booking-fulfillment` — partner broadcast (confirm, coach bus, generic) | partners | `workforce` | `sendSms` |
| `tt-assign-driver` — customer "your driver" SMS | customer, post-booking | `transactional` | `sendSms` |
| `tt-partner-response` — "already taken" reply to partners | partners | `workforce` | `sendSms` |
| `tt-partner-response` — David all-declined alert | internal operator | `internal` | `twilioSend` |
| `tt-release-expired-auths` — customer "authorization released" | customer, post-payment | `transactional` | `sendSms` |

`tt-finalize-accept` was already converted and served as the reference shape.

Every converted send now gets: `isSuppressed()` + `legalStopBlocked()` at the
`send-sms` chokepoint, an idempotency key (`tt-<fn>-<booking|dispatch_req>-<partner|phone>`),
an `outbound_messages` row, and no more per-function Twilio credential reads.

## Deliberate behaviour that will look like a bug: STOP kills dispatch

`opt_out_events` has **no program scope**. Every outbound message in the
project leaves from one shared Twilio number, so an inbound "STOP" to a
Grabba campaign is legally indistinguishable from a STOP to TopTier dispatch —
Twilio and the carrier both treat it as revocation for that number, full stop.

Consequently `legalStopBlocked()` is class-agnostic: a driver who STOPs any
programme **stops receiving TopTier job offers**. This is correct and
deliberate. `sendClass: 'workforce'` does NOT bypass suppression — workforce
only skips marketing-frequency rules, never consent. Do not "fix" this by
exempting dispatch; that re-opens the exact hole this conversion closed.
Per-program consent was considered 2026-08-22 and deferred: it is not worth
the legal exposure while everything shares one number.

## Suppression-skipped dispatch is now visible (named outcome, not an alert)

Before: suppression skipped the driver silently. Dispatch assumed
unavailability; the partner just went quiet and nobody could answer "why did
this good driver stop getting offers?"

Now, whenever a dispatch send is blocked by suppression:

1. **Function return payload** — the dispatch response carries
   `suppressed` / `suppressed_partners` (partner id, name, phone, reason) or
   the equivalent per-function field (`sms_delivery: 'suppressed'` in
   `tt-assign-driver`, `sms_suppressed` count in `tt-release-expired-auths`).
2. **Queryable row** — `tt_notifications_log` row of type
   `dispatch_suppressed` (partner) or `customer_sms_suppressed` (customer)
   written by `_shared/dispatchOutcome.ts`, with booking reference, recipient,
   class, and the blocker name. Ops query:

   ```sql
   select booking_reference, recipient_name, sent_to, message, created_at
   from public.tt_notifications_log
   where type in ('dispatch_suppressed','customer_sms_suppressed')
   order by created_at desc;
   ```

3. **No alert.** One skipped driver is not an incident; a pattern of them is.
   If `dispatch_suppressed` rows spike, that's a re-onboarding queue — the
   driver replies START (or is manually removed from `dnc_list`) and the next
   dispatch reaches him.

## Monitoring

`comms-health-monitor` now probes `send-sms` as a `function_deployment`
target. It needs a JSON probe (`probeDeployedJson` — POST `{}`, 400 =
healthy) because `send-sms` parses a JSON body and the form-encoded webhook
probe would 500 on a live function and read it as missing. Dispatch now
depends on this chokepoint; if `send-sms` goes red, all outbound SMS —
dispatch included — is down.
