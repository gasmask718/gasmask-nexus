# +1 888-302-2514 — recordings audit and voice-loop impact assessment

Date: 2026-08-18. Read-only. Nothing about voice was changed. No recordings deleted.
Tooling: `comms-stop-audit` actions `recordings`, `voice_impact` (new this pass),
`delete_recordings` (built, guarded, **not run**).

Window: 120 days (since 2026-04-20). Account `AC5833…1783` (main).

## 1. The 18 recordings

All 18 exist on **our** Twilio account, all `source = DialVerb`, all `status = completed`,
all **dual-channel (channels = 2)** — both sides of the conversation on separate tracks.
Total recorded audio: **35 seconds**. Recording charge: **$0.0025 each = $0.045 total**.

Two events, two calling parties, nine recordings each:

| Event | Date (UTC) | Other-leg number | Legs recorded | Durations |
|---|---|---|---|---|
| A | 2026-08-06 16:25:59 – 16:26:03 | +1 408-957-3817 | 9 | 1–4 s |
| B | 2026-08-13 00:51:08 – 00:51:11 | +1 410-285-7278 | 9 | 1–3 s |

Every recording's parent call is `direction = inbound`, `to = +18883022514`.
Full SID list is in the tool output; each is retrievable at
`/2010-04-01/Accounts/{AC…}/Recordings/{RE…}.mp3`.

## 2. Two-party consent

The **called** party on every leg is the toll-free number itself — a toll-free NPA has no
state, so a called-party test returns nothing. The exposure sits on the **other** leg, and
both of them are in all-party consent jurisdictions:

- **+1 408-957-3817 → California (NPA 408)** — all-party consent. 9 recordings.
- **+1 410-285-7278 → Maryland (NPA 410)** — all-party consent, and Maryland is the
  strictest wiretap statute in the country (criminal, felony-grade).

So: **18 of 18 recordings have a counterparty whose area code sits in an all-party consent
state.** No consent step exists anywhere in that call flow.

Two honest caveats, because this should not be overstated:

- Area code is a **routing prefix, not a location**. Numbers port and mobiles travel. It is
  the best signal available from Twilio's API — it is not proof of where the human was.
- The call pattern (21 legs per event, all within four seconds, 1–4 s of audio each) is
  consistent with **automated dialling into a recursion**, not with a human conversation.
  A 1-second stereo clip of a recursion is unlikely to contain anyone's speech. That
  reduces the practical harm; it does not change the legal shape of "recorded a call from
  a two-party state without a consent gate."

**Named exposure:** the Maryland leg (+1 410-285-7278, 2026-08-13, 9 recordings) is the one
worth naming. Maryland is the jurisdiction where this class of defect has criminal teeth.

## 3. Deleted — all 18, 2026-08-18

**Done.** `comms-stop-audit?action=delete_recordings` was run with the 18 explicit SIDs.
Result: `attempted: 18, deleted: 18` — **every** recording returned HTTP `204`, none returned
an error. A re-run of the `recordings` audit immediately afterwards returns
`recording_count: 0`, `dual_channel_count: 0`, `total_recorded_seconds: 0` for the number
over the same 120-day window. No partial delete, verified by re-read rather than by the
delete call's own report.

SIDs deleted (all 204):

```
RE0267faa185f1295a1c53dd2d0958dee4  RE0b9aef0ec4e25419da3d90806d8450b3
RE0ff9c1dca6f6546177ced1dd265d7dd6  RE1d83826557809fab0de212e6d34bb797
RE20893b8dfbfff8175a9f65e87b2b2606  RE258f87c78d52c04890275297d0ceb8af
RE2e9fe66fe7e9c48fbf755386f1be1d50  RE3377e8ba6e6c2a005b8ff5d2104a3895
RE76fafbacb3f5e7eae2ce408509740eab  RE81e401734b7833020da319794ad398da
RE92ee4112e0499a1b3b5ed892a3070f31  REb05e6ee1ef0d6097f7eb12ff70a88745
REc53dab47b92bf5bdc25193d65e5c92bb  REdf02f43df8d2eccfaf91c3cf32f13cb1
REe185ed5c351fadd153f6c151124a8230  REefd6f1944c80be9470fffb9564e262e9
REf0d9492787932c8adf44d1eea7be4a90  REfde76d2be28d2c9b7c631e0f0076e8ae
```

**What this does not reach.** Playboxxx's own copies — whatever that project pulled down
into its own storage — are **untouched and outside our reach**. Deleting the Twilio copy
narrows *our* exposure: it removes the copy we control and the copy Twilio would produce
under subpoena against our account. It does not clean the record.

## 3b. Original deletability finding (for reference)

**Yes.** The recordings are resources on our own account SID, so
`DELETE /2010-04-01/Accounts/{AC…}/Recordings/{RE…}.json` works from our credentials and
returns 204. That copy is ours to remove.

What deletion does **not** reach: whatever the Playboxxx project pulled down and stored in
its own bucket. Deleting the Twilio copy removes the copy we control and the copy Twilio
would produce under subpoena against our account. It does not remove theirs.

`comms-stop-audit?action=delete_recordings` takes `{ "sids": ["RE…"], "confirm": "DELETE" }`
— explicit SIDs only, no wildcard. **Executed 2026-08-18 against the 18; see section 3.**

## 4. The loop, and what changing VoiceUrl would break

Current config on the number:

```
voice_url        https://clrgkreqqgmycrskcmwq.supabase.co/functions/v1/twilio-twiml   (foreign)
status_callback  https://clrgkreqqgmycrskcmwq.supabase.co/functions/v1/twilio-webhook (foreign)
sms_url          https://qalaaroashbggynpvqct.supabase.co/functions/v1/twilio-sms-webhook (ours, repointed 2026-08-18)
voice_application_sid / trunk_sid / voice_fallback_url — all empty
```

**Correction to the earlier note.** The 42 legs are not self-dial in the From/To sense.
Every one is `direction = inbound`, `to = +18883022514`, and the caller ID is preserved
across the recursion:

```
self_dial_legs           0
inbound_external_legs   42
outbound_external_legs   0
distinct_external_callers 2   (+14089573817 × 21, +14102857278 × 21)
```

Twenty-one legs per caller, all inside four seconds, terminating in `busy`. That is the
TwiML answering an inbound call by dialling the same number again, carrying the original
caller ID down each generation, until Twilio's concurrency limit returns `busy` and the
recursion collapses. It is a loop; it is triggered *by* an inbound call, not spontaneously.

**What changing VoiceUrl would break — what I can tell:**

- **Nothing outbound depends on it.** `outbound_external_legs = 0` in 120 days. No
  application is placing calls *from* this number.
- **No trunk, no TwiML App, no fallback URL.** The `voice_url` is the single lever; there
  is no second path that would keep working or keep looping.
- **Two callers in 120 days, both automated-looking, neither with a preceding or following
  relationship anywhere in our data.** No human caller pattern.
- Repointing voice at `dc-inbound-call` stops the recursion immediately: our handler
  answers and does not dial the number back.

**What I cannot tell from here, said plainly:** whether the Playboxxx application *expects*
inbound calls on this number as part of a live flow that simply hasn't been exercised in
120 days. Twilio shows me traffic; it does not show me intent. I can see that nothing has
used it, not that nothing is meant to. The only way to close that gap is to ask whoever
runs Playboxxx now, or to accept 120 days of silence as sufficient evidence.

**Cost of the change:** one API POST setting `VoiceUrl` (and, if wanted,
`StatusCallback`) on `PNddac…1723`. Reversible in one POST — the current values are
recorded above. Risk is bounded to: if a live Playboxxx voice flow exists and is unused,
it would start failing at our handler instead of theirs, visibly, in our logs — which is
the opposite of the silent break we have been refusing to inflict on people.

**Cost of not changing it:** the loop fires again on the next inbound call, including wrong
numbers and robocallers. 120 days of history is $0.534 and 18 non-consensual recordings
from two events. There is no reason to expect a third event to be larger, and no mechanism
that would stop one.

---

## Voice repointed — 2026-08-18 17:43 UTC

Owner decision: repoint. Executed via `comms-stop-audit?action=repoint_voice`
(guarded by `confirm: "REPOINT_VOICE"`, writes `VoiceUrl` + `VoiceMethod` only).

Number SID `PNddac669fba74a306bd4e2bf502191723`.

| field | before | after |
|---|---|---|
| `voice_url` | `https://clrgkreqqgmycrskcmwq.supabase.co/functions/v1/twilio-twiml` | `https://qalaaroashbggynpvqct.supabase.co/functions/v1/dc-inbound-call` |
| `voice_method` | POST | POST |
| `voice_fallback_url` | (empty) | (empty) — unchanged |
| `voice_application_sid` | (empty) | (empty) — unchanged |
| `trunk_sid` | null | null — unchanged |
| `sms_url` | `…/twilio-sms-webhook` (ours) | unchanged |
| `status_callback` | `https://clrgkreqqgmycrskcmwq.supabase.co/functions/v1/twilio-webhook` | **left in place** |

**Verified by re-reading, not by trusting the write.** The action re-fetches
`IncomingPhoneNumbers` after the POST (`verified: true`), and a second, separate
`number_probe` call afterwards independently returns the new `voice_url`. Two reads,
one write.

**status_callback left alone.** It is not part of the loop: the recursion lives in the
TwiML *response body* served by `twilio-twiml`, which is what dials. A status callback is
a one-way, fire-and-forget POST from Twilio reporting call state; it returns no TwiML and
cannot originate a call. Leaving it is their telemetry at no cost to us — they now receive
status events for calls our handler answers, and nothing more.

**Can the loop recurse under our handler? No — by construction, with one caveat named.**
`dc-inbound-call` never dials the `To` number. It resolves a *destination DID* in a fixed
order — directory row (`v_phone_directory.assigned_agent_id`) → per-business env DID →
global `BLAND_INBOUND_NUMBER` — and emits a single `<Dial><Number>{that DID}</Number></Dial>`.
The dialled number is never derived from the caller or the called number, so there is no
path by which the inbound leg re-enters itself.

The one way it *could* produce the same shape is if the resolved DID were this number
itself. The repoint action pre-checks exactly that and refuses if true. Result recorded at
write time: `directory_row: null` (no row for this number), `global_env_did_set: true`,
`resolved_did_matches_this_number: false`. So the live behaviour on the next inbound call
is: one leg in, one `<Dial>` out to the global Bland DID, 20s timeout, then the
"unable to connect" `<Say>` + `<Hangup/>`. If the DID were ever unset, the handler says
"this line is not yet configured" and hangs up — no `<Dial>`, no recursion.

Also note: `dc-inbound-call` emits **no `<Record>`**. The recording exposure ends with the
repoint as well — nothing on our side will record this number again.

**Reversal:** one POST setting `VoiceUrl` back to
`https://clrgkreqqgmycrskcmwq.supabase.co/functions/v1/twilio-twiml` on `PNddac…1723`.
