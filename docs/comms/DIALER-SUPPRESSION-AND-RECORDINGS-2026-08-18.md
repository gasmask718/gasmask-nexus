# VA dialer — suppression enforcement, recordings exposure, calling windows

Date: 2026-08-18. Author: platform. Status: items 1–2 shipped, item 3 reported
only (no change), item 4 reported only (nothing deleted).

## 1. Normalization — shipped

`dnc_list` stores E.164 (`+17189222137`); lead sources (`store_master.phone`)
store display format (`(347) 201-6324`) — 1 of 1,897 rows was E.164. The
dialer's old check was `.eq("phone_number", leadPhone)` between those two
formats, so it could never match: a check that reported "DNC checked" in review
and was incapable of firing.

Fix, one key at both ends rather than migrating 1,897 lead rows:

- migration: generated STORED column `phone_last10` on `public.dnc_list` and
  `public.opt_out_events`, plus a btree index on each.
  `right(regexp_replace(<phone>, '\D','','g'), 10)`.
- `_shared/dnc.ts`: new exported `phoneLast10()` — the single normalization
  function used by both read paths. `isOnDNC()` and `isSuppressed()` now query
  `phone_last10` first, then fall back to the legacy exact-column `.in()` match.
- Both still fail CLOSED on lookup error.

Proof: `POST /va-power-dialer {action:"dial", leadPhone:"(848) 400-4179"}` →
`{skipped:true, reason:"STOP_keyword", source:"dnc_list"}` against the E.164 row
`+18484004179`. That exact call returned a dial before this change.

## 2. Enforcement point — shipped

The gate is now in `brandaro-call-twiml`, immediately before `<Dial>`, using
`isSuppressed()`. That is the last server-controlled point before a real phone
rings — Twilio dials only what we put in the TwiML body.

`va-power-dialer`'s check is kept as a fast UX skip and is documented in code as
NOT the gate: it returns JSON the browser is trusted to honour, and a modified
page, a stale tab, or a replayed TwiML App request reaches `<Dial>` without ever
calling it.

`va-power-dialer`'s own inline `?action=twiml` branch also emits `<Dial>`, so it
got the same gate.

Both fail closed: missing service-role key or a failed lookup returns
`<Say>…do not call list…</Say><Hangup/>` rather than a dial.

Proof: `GET /brandaro-call-twiml?To=+18484004179` → Say+Hangup;
`To=+19175550143` → normal `<Dial>`.

## 3. `verify_jwt = false` on va-power-dialer — reported, NOT changed

Reason it is off: the same function serves `?action=twiml`, a Twilio webhook.
Twilio cannot present a Supabase JWT, so flipping `verify_jwt = true` at the
platform level would 401 that callback and break dialing.

Correct fix (not applied tonight, deliberately): split the webhook out, or
validate the JWT in code for the `dial` / `disposition` JSON actions while
leaving the `twiml` branch open and protected by Twilio signature validation.
Now that enforcement lives before `<Dial>`, an unauthenticated `dial` call can
create a log row and burn a leaderboard increment, but cannot cause a call to a
suppressed number.

## 4. Recordings — reported, NOTHING deleted

Account `AC5833…1783` (Brandaro), enumerated read-only via
`va-recordings-audit` (diagnostic function, deletes nothing).

- **206 recordings** on the account, ~**135 minutes** total, longest **6m29s**.
- Duration: 80 ≤10s, 87 11–60s, 35 61–300s, 4 over 5 minutes.
- **169 of 206 are dual-channel** (`record-from-answer-dual`), i.e. both sides
  captured on separate tracks.
- Counterparty state by area code (hint, not fact — numbers port):
  NY 110, NJ 24, FL 10, NC 9, CA 3, TX 2, unresolved 48.
- All-party-consent states by that mapping: **13** (CA 3, FL 10). No MD.
- Top counterparties: `+18776818621` ×46, `+17183089391` ×45, `+19174643048`
  ×26, `+18484004179` ×24 — note the last one is now **on `dnc_list`**.
- No consent gate exists anywhere on this path; `brandaro-call-twiml` records
  unconditionally.

**Separate exposure found while counting:** 103 `va_call_logs.recording_url`
values point at the **public** storage bucket `call-recordings` (119 objects,
`public = true`). Anyone with a URL can fetch the audio without auth. This is a
larger issue than the Twilio-side copies and is not addressed here.

Nothing deleted — these are plausibly legitimate business records. Decisions
pending owner call: consent announcement before `<Dial>`, retention window, and
whether to flip the storage bucket private with signed URLs.

## 5. Calling windows — documented gap, deliberately not built

Not enforced anywhere on this path, and we are not enforcing until the data
supports it.

- `dialer_settings.business_timezone = America/New_York` is **our** timezone,
  not the recipient's. Enforcing on it would have been wrong for the 2026-05-14
  burst, which was heavily `+1787` (Puerto Rico, AST) and `+1661/+1213`
  (Pacific).
- `store_master` has no timezone column — only `state`.
- `store_communication_preferences.timezone` exists with 0 rows.
- Area code is the only recipient-local signal available: a guess dressed as a
  rule, wrong for any ported mobile.

**Prerequisite before any window ships:** a real timezone stored on the lead,
derived from state/address, with area code as an explicitly labelled fallback.
A window we cannot defend is worse than a documented gap.

## 6. Public recordings bucket — CLOSED 2026-08-18

`call-recordings` (119 objects, 103 referenced by `va_call_logs.recording_url`)
was `public = true`: anyone holding a URL fetched the audio unauthenticated.

- Bucket flipped **private**. Proof: the same object URL returned **200** before,
  **400** after (`.../object/public/call-recordings/brandaro/RE4e7db48….mp3`).
- `play-twilio-recording` now also proxies objects in this bucket: it
  authenticates the caller (`Authorization` header or `?token=`, role in
  owner/admin/developer/va/staff), then mints a 300s service-role signed URL and
  streams the bytes, honouring `Range`. Everything else still 400s — the
  allow-list is twilio.com plus this one bucket. Its session check moved from
  `auth.getClaims` (not present in supabase-js 2.45) to `auth.getUser`, which is
  why the first deploy 500'd.
  Proof: unauthenticated → 401; admin token → `200 audio/mpeg`, 477,623 bytes.
- Players repointed to `RecordingPlayer` (which attaches the session token,
  because `<audio src>` cannot send a header): `VAManagerPage` (×2),
  `VACallHistory`, `VACallWrapUpModal`, `VAAICoachingHub`,
  `BrandaroUnifiedCallHistory`, `AdminCallReview`,
  `communication/intelligence/CallRecordingPlayer`. The raw `download` anchors on
  the last two were removed — a `<a download>` cannot carry auth, and leaving it
  would just reproduce the shareable-link problem.
- Crawler/leak exposure: no sender writes a `call-recordings` URL into an SMS or
  email body (grepped every `recording_url` egress path), no committed file
  contains one, and `va_call_logs` has RLS on with admin/VA-scoped policies. The
  residual risk is any URL a human copied out before today; those objects are now
  private, so previously copied links are dead too.

## 7. `+18484004179` — the suppressed number's recordings

**29** recordings on the account involve this number (the earlier "24" was from a
truncated enrichment pass), 2026-01-23 through 2026-05-12.

- 18 `inbound` (they called us), 11 `outbound-api`.
- 28 mono, 1 dual-channel. Total ≈ 7.5 minutes; the two longest are 130s and 138s
  (both outbound, 2026-02-18); most are ≤10s.
- NPA 848 → **NJ**, a one-party consent state. No all-party exposure here.
- Timeline vs the opt-out: STOP landed **2026-08-18 16:24:17 UTC**; the newest
  recording is **2026-05-12**. **Nothing was recorded after the opt-out**, and
  with the `<Dial>` gate live nothing can be.
- Not deleted — pre-opt-out business records, and unlike the Playboxxx set none
  are from all-party states. Deletion is an owner call, not a compliance forcing
  function.

## 8. The 29 — owner decision: KEEP

Pre-opt-out, NJ (one-party), genuine business records. No compliance reason to
delete and a records reason not to. Closed.

## 9. The 13 all-party-state recordings — itemised

Re-enumerated with full enrichment (206/206 detailed, not a truncated pass).
All 13 are **dual-channel** (`record-from-answer-dual`) and all 13 are **outbound
from us**: the parent leg reads `direction=inbound` because it originates from the
browser Voice SDK into Twilio; the counterparty is the `To` on the dialed leg.
The `From` values are our own Brandaro DIDs (`+19292389353` NY,
`+18483588206` NJ, both in `dc_phone_numbers`) plus toll-free `+18776818621`.

**The counterparty was the callee in every one of the 13. We placed the call,
we recorded both channels, and no announcement was played.** Under CA Penal Code
632/632.7 and FL 934.03 that is the exposed posture; there is no "they called us"
mitigation available on any of these.

| # | Date (UTC) | State | Dur | Counterparty (callee) | Our caller ID | Recording SID |
|---|---|---|---|---|---|---|
| 1 | 2026-05-14 16:41:14 | FL | 12s | +13054882037 | +18483588206 | RE6b75129ebcc5dbc9ed33e99adf1c5dbc |
| 2 | 2026-05-14 16:43:31 | FL | 15s | +14072501292 | +18483588206 | REbd7b27f4a502c0d58340e0b10eae256f |
| 3 | 2026-05-14 16:55:21 | CA | 4s | +16616952560 | +18483588206 | RE5719c70a09d558624268c41d1eb8060e |
| 4 | 2026-05-14 16:56:08 | CA | 15s | +16614218658 | +18483588206 | RE9926259f950ab84e2e9c08bd080a233a |
| 5 | 2026-05-14 16:57:18 | CA | 4s | +16614124595 | +18483588206 | RE733510d96a8fa0ab601a6fff39de78e9 |
| 6 | 2026-05-14 17:00:04 | FL | 2s | +13054882037 | +18483588206 | RE73cf70daf931da725427000eefcc45c5 |
| 7 | 2026-05-14 17:13:37 | FL | 54s | +17544224505 | +19292389353 | RE56011febafaba26f7313d78fc557197b |
| 8 | 2026-05-15 01:10:05 | FL | 10s | +13054882037 | +19292389353 | RE26c2f7acce84a9b02a3be222d312ea65 |
| 9 | 2026-05-15 01:11:41 | FL | 11s | +14072501292 | +19292389353 | REfaa2add1010531cad895aa969f7e3f93 |
| 10 | 2026-08-06 20:22:27 | FL | 11s | +17542355408 | +18776818621 | RE8717eda959251b75092aed864cb3aebd |
| 11 | 2026-08-06 20:23:18 | FL | 11s | +17542355408 | +18776818621 | REdfe416f59a9e6ef91462700bd1a5069e |
| 12 | 2026-08-06 20:25:34 | FL | 30s | +17542355408 | +18776818621 | RE8a74f647e2cb12a6e4215b616971d244 |
| 13 | 2026-08-06 21:58:46 | FL | 38s | +17542355408 | +18776818621 | RE0f7ca888a5043c29ee205350546b2224 |

Totals: 10 FL, 3 CA. 217 seconds (3m37s) across all 13; longest 54s; 8 of 13 are
≤15s (ring-outs, voicemail greetings, immediate hangups — thin conversational
content, but a recorded call is a recorded call under both statutes). Three
distinct FL callees on 2026-05-14/15, one FL callee (+17542355408) four times on
2026-08-06, three CA callees in a 2-minute burst (661 = Bakersfield, consistent
with a Places-sourced list, not a warm relationship).

State is inferred from NPA. It is a hint: a ported mobile breaks it, and it is
the *number's* state, not the person's location at the time — which is what CA
632.7 actually turns on. Treat the 13 as a floor, not a census; 48 of 206
recordings resolved to `unknown` NPA and were never checked at all.

## 10. Consent gate — what it would actually need

Current behaviour: `brandaro-call-twiml:144` and `va-power-dialer:46` both emit
`record="record-from-answer-dual"` as a literal, unconditional string. There is
no consent step, no per-state branch, and no way to turn it off short of a code
change. Ten other functions carry the same literal
(`ambassador-direct-call`, `field-portal-comms`, `gasmask-*`, `twilio-voice-*`,
`transfer-campaign-call`, `twilio-bridge-to-bland`, `twilio-gather-webhook`,
`twilio-human-queue-hold`, `twilio-transfer-choice-webhook`) — a gate that only
covers the VA dialer leaves nine other paths recording unconditionally.

A defensible gate needs four things, in order:

1. **Recipient jurisdiction, per lead, stored.** This is the blocker, and it is
   the *same* blocker as calling windows — see §5. Both questions are "where is
   the person on the other end", asked once.
2. **A policy table**, not a hardcoded `Set`. All-party status changes by statute
   and by interpretation; it belongs in a `recording_consent_policy` row per
   state (`all_party | one_party | prohibited`) with an effective date, not
   inline in five functions.
3. **A branch before the `record` attribute**: one-party → `record-from-answer-dual`
   unchanged; all-party → either (a) a `<Say>` announcement before `<Dial>` plus
   dual-channel, or (b) `record-from-answer` single-channel of our own leg only,
   which several readings treat as materially safer, or (c) no recording. That is
   a business choice, not a technical one — announcement kills answer rate,
   single-channel kills the AI coaching/transcript product.
4. **Fail closed on unknown.** If jurisdiction is unresolved, do NOT record. With
   48/206 unknown today, a gate that defaults to recording on unknown is not a
   gate.

**On the shared-data point: yes, you're right.** Both features need one field:
a real recipient jurisdiction/timezone on the lead. The data available now:

- `store_master`: 3,152 rows, `state` populated on all of them and `zip`
  populated on all of them — but **`state` is dirty**: 2,036 `NY`, **1,091 empty
  strings**, plus `Queens`, `ny`, `New York`, `NY)`. Zero rows in any all-party
  state, which is not reassuring — it means the 13 CA/FL callees are not in
  `store_master` under a usable state at all.
- `store_master.consent_source` / `consent_timestamp` exist and are **0/3,152
  populated**. The columns for this already exist and have never been written.
- `store_communication_preferences.timezone`: still **0 rows**.

So the one prerequisite, shared by consent gating and calling windows:
**derive a canonical `state` + IANA timezone per lead from `zip` (clean, 100%
populated) rather than from the free-text `state` column or the area code, store
it on the lead, and label the fallback explicitly.** Zip → state → timezone is a
static lookup, no API, no cost. Once that lands, both the recording branch and
the calling-window check read the same column and neither is a guess.

Recommended order when you want it built: zip→jurisdiction backfill first, then
the policy table, then the `record` branch (fail-closed), then windows. Nothing
in this section is implemented — report only.
