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
