# STOP routing defect — before/after proof

Date: 2026-08-18
Owner: Nexus
Target number: **+18776818621** (verified toll-free, GMA CUSTOMERSERVICE)
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
   sees a STOP that arrived through the live handler.
2. It matched `store_contacts.phone = p_phone` exactly. A STOP from a number
   that is not a store contact, or stored in any other format
   (`+1 718-922-2137` is how the one real opt-out is stored), updates zero rows
   and returns NULL with no error. Suppression required the sender to already
   be known to us.

## PREDICTION (written before the run)

Sending a literal `STOP` from +18484004179 to +18776818621 will produce:

- Twilio API: **201** accepted, message SID returned.
- Webhook: **200** / empty TwiML from `twilio-sms-webhook`.
- `communication_logs`: **+1** inbound row, summary "Customer opted out (STOP)".
- `store_contacts`: **unchanged** (sender is not a contact) — 1 opted_out row before, 1 after.
- `dnc_list`: **0 → 0**.
- `opt_out_events`: **0 → 0**.

## BEFORE run

(filled in below by the actual observation)

## AFTER run

(filled in below by the actual observation)
