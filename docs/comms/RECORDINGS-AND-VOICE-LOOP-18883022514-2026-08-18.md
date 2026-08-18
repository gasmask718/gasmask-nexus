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

## 3. Can we delete them

**Yes.** The recordings are resources on our own account SID, so
`DELETE /2010-04-01/Accounts/{AC…}/Recordings/{RE…}.json` works from our credentials and
returns 204. That copy is ours to remove.

What deletion does **not** reach: whatever the Playboxxx project pulled down and stored in
its own bucket. Deleting the Twilio copy removes the copy we control and the copy Twilio
would produce under subpoena against our account. It does not remove theirs.

`comms-stop-audit?action=delete_recordings` is built and takes
`{ "sids": ["RE…"], "confirm": "DELETE" }` — explicit SIDs only, no wildcard, no run yet.
Say the word and it runs against the 18.

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
