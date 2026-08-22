# Ambassador / UT-growth SMS → send-sms conversion + two recorded-not-fixed findings

**Date:** 2026-08-22
**Status:** shipped (conversion); two findings recorded, deliberately not repaired

## What changed

All six ambassador/UT-facing SMS functions were converted off direct
`api.twilio.com/.../Messages.json` POSTs (and one connector-gateway POST) onto
the shared helpers. Zero direct Twilio posts remain in these six (verified by
grep). **Sender parity preserved** — every send presents the same
`TWILIO_FROM_NUMBER` / `TWILIO_PHONE_NUMBER` it did before. See "Sender"
below before moving any of them.

| Function | What it sends | Audience | Class | Helper |
|---|---|---|---|---|
| `ambassador-approve-sms` | application approved + referral link | applicant | `transactional` | `_shared/sendSms.ts` → `send-sms` |
| `ambassador-notify` | approval / conversion / milestone / payout_paid / tier_upgrade notices | ambassador | `transactional` | `sendSms` |
| `ambassador-sale-webhook` | "you earned $X commission" | ambassador | `transactional` | `sendSms` (dead path — see below) |
| `ut-track-ambassador-sale` | "you earned $X" + tier-upgrade notice | ambassador | `transactional` | `sendSms` (dead path — see below) |
| `ut-growth-engine/run_sms_outreach` | cold recruitment outreach to `ut_leads` | cold leads | **`campaign`** | `sendSms` |
| `ut-growth-engine/send_daily_report` | daily growth report to David | internal operator | `internal` | `_shared/twilioSend.ts` |
| `ut-ambassador-finder/send_dm_alert` | top-prospect alert to David | internal operator | `internal` | `twilioSend` |

Class rationale: approval/commission/payout notices are person-triggered
financial or status messages about something that already happened →
transactional. `run_sms_outreach` texts people who have no relationship with
UT yet → campaign, full stop. That one is quiet today only because `ut_leads`
has 0 rows; converting it now is free, converting it after the table is
populated is a migration under load.

Every converted send now gets `isSuppressed()` + `legalStopBlocked()` at the
`send-sms` chokepoint, a deterministic idempotency key, and an
`outbound_messages` row. Campaign sends keep the per-number cooldown and get
`campaignMaxSends` = batch size; transactional sends use `skipCooldown` (one
event = one send).

### Suppressed recruitment sends are visible, not silent

In `run_sms_outreach`, a suppression-blocked lead is logged to
`ut_outreach_log` with `status='blocked'` and the blocker in `error_message`,
counted in the response as `blocked` (separate from `failed`), and — unlike a
successful send — the lead is **not** marked `contacted`, so if the recipient
later replies START the next run can still reach them. `ut_outreach_log.status`
is free text (verified — no check constraint), so `'blocked'` inserts cleanly.

## Recorded, NOT fixed — two functions that cannot succeed in Nexus

These two were converted so their send paths are correct if they ever run, but
they currently cannot reach the send path at all. Do not "repair" them by
repointing at Nexus tables — whether ambassador sales live in Nexus or UT is
an architecture decision, and answering it by patching a table reference is
how you get two systems that half-own the same thing.

### `ambassador-sale-webhook`

- Queries `ambassadors` with `.eq("status", "active")` and selects
  `full_name, phone, commission_rate`. Nexus's `ambassadors` table exists but
  is the **Grabba/dispatch ambassador entity** — same name, different shape:
  it has `is_active` (not `status`), `name` (not `full_name`), no
  `commission_rate`. PostgREST rejects the query → function 404s at step 1.
- Inserts into `ambassador_sales`, which **does not exist in Nexus**. The only
  similarly-named Nexus table is `uben_ambassador_sales` (UBEN brand, created
  by migration 20260408155731 — a different programme with different tiers).
- The schema this function was written against (`ambassadors.status` +
  `commission_rate`, `ambassador_sales`, tiers starter/rising/elite/legend at
  15/17/20/22%) matches **UT's own Supabase project**, which has an
  `ambassador_sales` table with a real row in it.

### `ut-track-ambassador-sale`

- Reads `ut_pub_ambassadors` / `ut_pub_referrals` / `ut_profiles`. All three
  **exist** in Nexus — but `ut_pub_ambassadors` and `ut_pub_referrals` hold
  **0 rows**, so the function always throws "Ambassador not found". The live
  UT ambassador rows are in UT's own project; Nexus's local mirror of UT
  ambassadors is `unforgettable_ambassadors` (6 rows, different schema —
  `referral_code`, not `ref_code`).
- The pre-existing accumulated-totals defect (read-modify-write of
  `total_sales`/`total_earned`/`tier`) is unchanged and still tracked in
  `docs/architecture/known-issues-accumulated-ambassador-totals.md`.

## Sender — UT-branded messages go out on the Nexus number, deliberately

None of these functions used the UT line (+19294990837) before conversion, and
none do now. All seven send sites resolve to the shared Nexus sender
(`TWILIO_FROM_NUMBER`, falling back to `TWILIO_PHONE_NUMBER`). That is
**deliberate for now**. Moving them to a UT sender is a cross-project build,
not a config change, and should be someone's explicit decision:

1. The UT number is **inactive** in `dc_phone_numbers` — it cannot send today.
2. UT's Messaging Service routes **inbound to UT's own backend**. A STOP
   replied to a UT-sent message would land in UT's project, and Nexus
   suppression (`dnc_list` / `opt_out_events`) would never see it unless UT
   mirrors it back. Without that mirror, switching the sender **breaks the
   legal-STOP gate this conversion just installed**.
3. **A2P guard caveat:** passing `from` does not necessarily control the
   sender. `send-sms` prefers a globally configured
   `TWILIO_MESSAGING_SERVICE_SID` over `From` (send-sms/index.ts: when the
   Service SID is set it appends `MessagingServiceSid` and drops `From`).
   Whoever does the sender follow-up must check whether a Messaging Service
   SID is configured before assuming a `from` argument is one line — and per
   the A2P plan (docs/a2p-10dlc-registration-plan.md), long-code `From`
   values are guard-railed anyway.

## Verification

- All six functions deploy and boot clean.
- `rg "api.twilio.com|TWILIO_ACCOUNT_SID|TWILIO_AUTH_TOKEN"` across the six
  directories: zero hits.
- Blast radius note: there is exactly one real ambassador (Tristan), and the
  two sale-notification paths are dead on arrival until the schema question is
  decided — so the class assignments can be validated against reality before
  volume exists.
