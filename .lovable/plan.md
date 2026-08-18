# Phase 2 — SMS Caller Consolidation

Goal: stop individual edge functions from calling Twilio's Messages API directly. All outbound SMS should flow through the one canonical sender (`send-sms`), so suppression/DNC, idempotency, logging, and credential rules apply everywhere.

## What exists today

- `send-sms` is the canonical chokepoint: it normalizes the number, checks suppression (`dnc_list` + opt-out events), enforces idempotency, daily limits, per-number cooldown, duplicate-content detection, writes an `outbound_messages` row, then calls Twilio (or BizText) and records the result. It runs with `verify_jwt = false`.
- 73 files under `supabase/functions/` still POST to `https://api.twilio.com/.../Messages.json` themselves. The four named in the request each do it slightly differently:
  - `sbo-send-daily-sms` — own `sendSMS()` helper, throws on non-2xx, logs to `sbo_sms_log` with `twilio_sid`.
  - `sbo-send-picks-sms` — loops subscribers, returns early with "Twilio not configured", logs to `sbo_sms_sends_log`.
  - `dd-cart-recovery-cron` — `sendTwilio()` using `TWILIO_FROM_NUMBER`, returns `{ok:false,error}` per cart.
  - `brandaro-send-followup` — inline fetch using `BRANDARO_TWILIO_NUMBER`, logs to `brandaro_message_log`.

## Approach

### 1. New shared helper `_shared/sendSms.ts`

A single function every caller uses:

```
sendSms({ to, body, idempotencyKey, from?, purpose?, metadata?, skipCooldown?, provider? })
  -> { success, status, providerMessageId, errorCode, errorMessage, raw }
```

It POSTs to `${SUPABASE_URL}/functions/v1/send-sms` with the service-role key, never throws, and always returns a structured result so existing per-recipient error handling keeps working. It never returns Twilio credentials or raw auth details to the caller.

Behavior notes baked into the helper so consolidation does not change delivery:
- `explicit_provider: "twilio"` by default, so functions that are Twilio-specific today keep going out over Twilio rather than falling back to the account's default provider (currently BizText).
- `from` is passed through so brand-scoped numbers (`BRANDARO_TWILIO_NUMBER`, `TWILIO_FROM_NUMBER`) are preserved.
- Callers supply a deterministic `idempotencyKey` (e.g. `sbo-picks-<date>-<phone>`, `dd-cart-<cartId>`, `brandaro-fu-<followupId>`) so retries and cron re-runs do not double-send.
- `skipCooldown` is set only where the current behavior is a legitimate per-event send (order updates, cart recovery per cart, followups on their own schedule); broadcast lists keep the cooldown.

### 2. Refactor tranche 1 (this plan)

The four named functions plus the two adjacent ones that share their code paths:

- `sbo-send-daily-sms`
- `sbo-send-picks-sms`
- `sbo-daily-automation` (same SBO send pattern)
- `dd-cart-recovery-cron`
- `brandaro-send-followup`
- `brandaro-send-followups`

For each: delete the local Twilio helper and env reads, call `sendSms(...)`, and keep every existing log insert, counter, and response shape unchanged — the only change is where the message id / error string comes from. Blocked-by-suppression results are logged as a non-fatal skip rather than an error.

### 3. Verification

- Typecheck the changed functions and deploy them.
- Dry-run check: confirm each refactored function still returns its original JSON shape, and that a suppressed number produces a skip (not a crash) rather than a Twilio call.
- No paid sends are triggered as part of the refactor; verification uses existing logs and a single opt-in test send only if you want one.

### 4. Documentation

Update `docs/infrastructure/twilio-egress-inventory.md`: move the refactored functions out of "SMS dispatch (direct REST)" into a new "Routed through send-sms" section, and record the remaining count for the next tranche.

## Remaining after this tranche

~67 direct SMS callers remain (TopTier `tt-*`, Dynasty Direct `dd-*`, ambassador, UT, supplier, health probes). These come in follow-up tranches grouped by brand so each one can be reviewed and deployed independently. Health/diagnostic functions (`admin-twilio-test`, `check-twilio-health`, `tt-deliverability-test`) intentionally keep direct Twilio access — they exist to test the credentials themselves.
