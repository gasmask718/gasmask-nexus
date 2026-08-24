# Number routing + registry reconciliation — 2026-08-24

Write-mode. Scope: two newly purchased numbers, four off-book numbers, one phantom row.
Nothing else in Twilio or `dc_phone_numbers` was touched.

## Reference config read live (+19298225712, GasMask, working today)

| field | value |
|---|---|
| sms_url | `…/functions/v1/twilio-sms-webhook` |
| voice_url | `…/functions/v1/twilio-inbound-call` |
| status_callback | **null** |

Two things the reference does NOT have, so they were not propagated:

1. **No `?biz=` parameter.** No number on either account carries one. `biz` is a
   *hint* only in `_shared/inboundVoiceMain.ts`; primary resolution is
   `To` number → `dc_phone_numbers`/`v_phone_directory` → business + policy.
   Adding a biz param would have been inventing a convention, and it is
   unnecessary because both new numbers already have correct rows.
2. **No status callback.** HELD, not set. The fleet is split: 20 numbers pair
   `dc-inbound-call` + `dc-call-status`; the reference and 6 others (including
   the approved toll-free, which uses `twilio-call-status`) have either none or a
   different one. `dc-call-status` is documented as the **outbound dialer pool**
   callback, not an inbound one. Picking one from a 3-way split would be a guess.
   Voice/SMS routing is unaffected — status callback is telemetry.

## PART A — before / after

### Twilio

| number | field | before | after |
|---|---|---|---|
| +18886161979 | voice_url | null | `…/twilio-inbound-call` |
| +18886161979 | sms_url | (empty) | `…/twilio-sms-webhook` |
| +18886161979 | status_callback | null | **null (held)** |
| +19293293692 | voice_url | null | `…/twilio-inbound-call` |
| +19293293692 | sms_url | (empty) | `…/twilio-sms-webhook` |
| +19293293692 | status_callback | null | **null (held)** |

Both writes verified by re-reading the number off Twilio after the PUT
(`verified: true`). Self-dial precheck passed on both: resolved DID ≠ this number.
No Messaging Service attached to either — deliberate.

### dc_phone_numbers

| number | field | before | after |
|---|---|---|---|
| +18886161979 | twilio_sid | null | `PN7386186f6025175b27964e30cb84f515` |
| +18886161979 | webhook_url / sms_webhook_url | null | as above |
| +18886161979 | twilio_webhook_configured | false | true |
| +19293293692 | twilio_sid | null | `PNea1f5fb8470895b10e56d6a304265dc2` |
| +19293293692 | webhook_url / sms_webhook_url | null | as above |
| +19293293692 | twilio_webhook_configured | false | true |

Business assignment unchanged: `brightsun_solar` and `dynasty_direct`.

### Registration path

- **+18886161979** — toll-free → **Toll-Free Verification**.
- **+19293293692** — local long code → **10DLC brand + campaign**. Unregistered
  today, so any outbound will fail 30034. Inbound is unaffected.

### Does anything route to them?

No. `rg` across `src/` and `supabase/functions/` returns zero references to
either number. Nothing points at them; they were inert before today and are now
inbound-capable only.

### is_default_caller_id — correction to finding 4.5

Both new rows carry `is_default_caller_id=true`. **The claim that nothing reads
it is wrong.** It is read in two places: `src/hooks/useVACallerIds.ts`
(orders the VA caller-ID list and picks the default) and
`supabase/functions/power-dialer-admin/index.ts` (selects the default caller ID
for a business). It remains true that Bland substitutes its own caller ID on the
AI voice path. Not fixed in this pass — recorded.

## PART B — off-book numbers

Four, not three. Backfilled into `dc_phone_numbers` with values read live:

| number | business | type | active | note |
|---|---|---|---|---|
| +18776818621 | **gasmask** | toll-free | true | A2P-approved verified sender; hardcoded as the GasMask toll-free in 12 edge functions |
| +18777344875 | unassigned | toll-free | false | no brand evidence, no traffic |
| +19546860097 | unassigned | local | false | no brand evidence (STOP tests + one inbound MMS) |
| +18883022514 | unassigned | toll-free | false | **status callback points at `clrgkreqqgmycrskcmwq`** — recorded as found, NOT repointed, NOT released |

### The three-vs-four contradiction

**Four is right.** The 08-24 A2P report put +18776818621 inside Group A because
that grouping was assembled from **Twilio's `IncomingPhoneNumbers` list**, keyed
by the business inferred from the webhook/usage — not from `dc_phone_numbers`.
So every "group by business" output produced that day is sourced from Twilio,
not from the registry we are about to file from. With the backfill above the two
sources now agree on membership; the groupings should be regenerated from
`dc_phone_numbers` before anything is filed.

### +19292623850 — in the table, not on the main account

It exists on the **quarantine subaccount** `AC9732af1ab1b4aea957820eb83e03cef9`
("QUARANTINE - Playboxxx"), SID `PNaba62b7860e234ea669a05edcbc4ef61`, with all
three webhooks null — inert there.

What is still addressing it: two live code sites hardcode it —
`supabase/functions/brandaro-fetch-recordings/index.ts:22` and
`src/pages/brandaro/VAManagerPage.tsx:129` (queries `twilio_number =
'+19292623850'`). Sends using it as a from-number on the **main** account fail,
because the main account does not own it. That is the 85 failed sends. The fix
is to stop pointing Brandaro at a quarantined number, not to move the number —
left for a decision.

## Still open

- Status callback for the two new numbers — needs a decision on which of the
  three current shapes is canonical.
- Toll-free verification filing (+18886161979) and 10DLC filing (+19293293692).
- Regenerate the A2P "group by business" lists from `dc_phone_numbers`.
- Brandaro's two hardcoded references to the quarantined +19292623850.
