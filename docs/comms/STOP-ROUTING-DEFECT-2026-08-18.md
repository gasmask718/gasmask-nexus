# STOP routing defect — before/after proof

Date: 2026-08-18
Owner: Nexus
Target number: **+18776818621** (verified toll-free, in Messaging Service `MGc6b4c9a273d43827295cfa329f22a222` "GMA CUSTOMERSERVICE")
Test sender: **+18484004179** (owned Twilio long code — deliberately not a primary sender)

## Defect

`twilio-sms-webhook` STOP path calls `public.handle_sms_opt_out(p_phone, p_method)`.
That function only ran:

```sql
UPDATE store_contacts SET opted_out = true ... WHERE phone = p_phone
```

Two failures:

1. It never wrote `dnc_list` or `opt_out_events` — the only two tables
   `_shared/dnc.ts :: isSuppressed()` reads. The chokepoint therefore never
   saw a STOP that arrived through the live handler.
2. It matched `store_contacts.phone = p_phone` exactly. A STOP from a number
   that is not a store contact, or stored in another format
   (`+1 718-922-2137` is how the one real opt-out is stored), updated zero rows
   and returned NULL with no error. Suppression required the sender to already
   be known to us.

## PREDICTION (written before the run)

Literal `STOP` from +18484004179 to +18776818621 would produce:
201 accepted; webhook 200; +1 inbound `communication_logs` row;
`store_contacts` unchanged (1 → 1); `dnc_list` 0 → 0; `opt_out_events` 0 → 0.

## BEFORE run — 2026-08-18 16:21:22Z — PREDICTION CONFIRMED

- Twilio: `201`, SID `SM001b6f974851efd71f68c148d26e2a44`.
- Inbound arrived `16:21:25.334Z`, `communication_logs` id `5bc52e75`,
  summary "Customer opted out (STOP)". Handler ran.
- `dnc_list` **0**, `opt_out_events` **0**, `store_contacts.opted_out` **1** (unchanged).
- Side observation: Twilio's own carrier-level opt-out auto-reply
  ("You have successfully been unsubscribed…") came back inbound at 16:21:27
  and logged as "Inbound from unknown number".

## FIX (migration, 2026-08-18)

`handle_sms_opt_out` now, in order:
1. normalizes to E.164 via new `public.normalize_phone_e164()`;
2. **unconditionally** upserts `opt_out_events` and `dnc_list`
   (`source = 'sms_inbound'`, `ON CONFLICT (phone_number)`);
3. then best-effort updates `store_contacts` matched on the **last 10 digits**,
   so format drift no longer matters and CRM accuracy is a side effect, not a gate.

`handle_sms_opt_in` (START) now deletes the matching `opt_out_events` row and the
`dnc_list` row **only when `source = 'sms_inbound'`** — manual/regulatory DNC
entries are never lifted by a START text.

`EXECUTE` on both is revoked from `anon`/`authenticated`; service_role only.

## AFTER run — 2026-08-18 16:24:15Z — FIXED

- Twilio: `201`, SID `SMb1a7f7db65e9d0912ca538b17b20f6b5`.
- `16:24:17.246Z`: `dnc_list` **1** (`+18484004179`, `sms_inbound`, `STOP_keyword`),
  `opt_out_events` **1** (same).
- Chokepoint proof: `POST send-sms {to_number:+18484004179}` →
  `{"success":false,"status":"blocked","reason":"STOP_keyword","source":"dnc_list"}`.
  Nothing left the building.

> The `+18484004179` suppression row is a real test artifact and is intentionally
> left in place. It is our own number. Twilio has also carrier-blocked
> +18776818621 → +18484004179 as a result of the test.

## Messaging Service override audit (7 services)

`use_inbound_webhook_on_number = false` means the **service** URL wins over the
number-level `sms_url`:

| Service | inbound_request_url | number wins? | pool |
|---|---|---|---|
| GMA CUSTOMERSERVICE `MGc6b4…` | `…/twilio-sms-webhook` | **no — service wins** | +18776818621, +19298225712 |
| real_estate `MG6b88…` | `…/twilio-sms-webhook?biz=real_estate` | **no — service wins** | +19292983199 |
| unforgettable_times `MG3440…` | `…/twilio-sms-webhook?biz=unforgettable_times` | **no — service wins** | (empty) |
| Unforgettable Times `MGcb31…` | `https://pxylmrmwqmxotqffejbe…/twilio-inbound-sms` | **no — service wins** | +19294990837 |
| playboxxx `MG0bad…` | (empty, fallback only) | yes | (empty) |
| Default for Conversations `MG2ad6…` | `…/twilio-sms-webhook` | yes | (empty) |
| Invoice messaging `MG7e51…` | (empty) | yes | (empty) |

No override points anywhere unexpected. +18776818621's service URL is the same
`twilio-sms-webhook` as its number URL, so the test above exercised the real path.
+19294990837 is correctly overridden to the UT project.

## dc_phone_numbers.sms_webhook_url backfill

26 live numbers on the account; 22 matched DB rows backfilled from the live API.

- **1 DB row still NULL**: `+19292623850` — quarantined Playboxxx line, moved to an
  isolated subaccount 2026-07-31, no longer on this account. Correct to leave NULL.
- **4 live numbers absent from `dc_phone_numbers`** (unauditable until added):
  - `+19546860097` → `…/twilio-sms-webhook` (expected)
  - `+18776818621` → `…/twilio-sms-webhook` (expected — this is the main TF)
  - `+18777344875` → `…/twilio-sms-webhook` (expected)
  - `+18883022514` → **`https://clrgkreqqgmycrskcmwq.supabase.co/functions/v1/messaging-inbound`**
    — a different Supabase project. Not a defect per se, but it is a number on our
    Twilio account whose inbound goes to a system this OS has no record of.

Every other number's live `sms_url` is `…/functions/v1/twilio-sms-webhook`. No
number carries an `sms_application_sid`, so no TwiML-App layer is in play.
