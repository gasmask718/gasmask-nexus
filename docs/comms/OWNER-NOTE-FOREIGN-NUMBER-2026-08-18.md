# Owner note — the toll-free number left behind by the Playboxxx move

Date: 2026-08-18. Prepared for a decision, not a fix. Nothing about voice was changed.

## The short version

One phone number on our Twilio account, **+1 888-302-2514**, sends everything it
receives to a system we do not own and cannot look inside. It is the **Playboxxx**
setup that was moved out on **31 July 2026**. The project moved; this number did not.
It stayed on our main Twilio account, still pointing at Playboxxx.

We pay for the number and Twilio holds us responsible for what it does.

Today we changed **one** thing: **text messages** now come back to us, so if someone
texts STOP to that number we actually record it and stop messaging them. That was safe —
the number has sent and received **zero** text messages in 120 days, so nothing live
could break. **Phone calls were deliberately left alone.**

## The three findings, in plain words

**1. One incoming call turns into dozens.**
When someone phones it, the Playboxxx call script answers by dialling the same number
again — and again — each new leg still carrying the *original* caller's number, until
Twilio's own limit cuts it off. (Earlier notes called this "the number calls itself." That
label was wrong in a way that sends you looking in the wrong place: in Twilio's records all
42 legs appear as **incoming calls from the two original callers**, not as calls our number
placed. Same bill, same behaviour, different place to look. Detail in
RECORDINGS-AND-VOICE-LOOP-18883022514-2026-08-18.md.)
It has done this twice that we can see: **6 August** and **13 August** — 42 call legs in
total, most of them inside a few seconds. Cost so far: **$0.53** over 120 days, 69 seconds
of billed time. The money is trivial; the point is that it fires by itself and will fire
again whenever anyone dials the number, including wrong numbers and robocallers.

It cannot be stopped without either changing the call handling (which means touching
Playboxxx's setup) or giving the number up. There is no third lever.

**2. It recorded calls without a consent step — our copies are now deleted.**
Every one of those calls was recorded in stereo — both sides of the conversation.
**18 recordings**, all billed to us, all with a counterparty in a state that requires both
people on a call to agree to being recorded (California and Maryland). There is no consent
step anywhere in that flow.

On **18 August 2026** we deleted all 18 from our Twilio account. Every one confirmed
deleted, and a re-check afterwards shows zero recordings left on the number. They were
1–4 second clips from the dialling loop, so there is almost certainly no human speech in
them and no evidential value to anyone.

**What that does not fix:** whatever the Playboxxx system pulled down and kept in its own
storage is **untouched and outside our reach**. Deleting our copies narrows our exposure —
it removes the copy we hold and the copy Twilio would hand over on a subpoena against our
account. It does not clean the record.

**3. The Playboxxx system answers anyone who knocks.**
Its text and call endpoints accept messages from the open internet without checking that
Twilio actually sent them. Anyone who knows the web addresses can trigger them. That is
Playboxxx's system, not ours — but it is **our** number pointing at it.

## The full count you asked for

We checked every number on both Twilio accounts — **27 numbers**, main account plus the
Playboxxx quarantine subaccount. **Exactly one** points anywhere outside our own systems,
and it is this one. The quarantine did not leave others behind.

(The Playboxxx subaccount holds one number, +1 929-262-3850, with no webhooks set at all —
inert. Everything else points at our own system.)

## The decision

Three options, and it is yours:

- **Shut it down.** Release the number. No text traffic in 120 days, no live caller
  depends on it, and it ends the loop, the recordings and the liability in one step.
- **Document it.** Keep it, write down who owns Playboxxx now, and get the call handling
  fixed on their side so it stops dialling itself and stops recording without consent.
- **Hand it back.** Move the number onto whoever runs Playboxxx now, so the bill and the
  responsibility sit with the same person.

Until you choose, the position is: texts come to us and are handled properly; calls still
go to Playboxxx, still loop, still record.

## On the calls: what redirecting them would actually cost

We have deliberately **not** touched the call handling, because Twilio shows us traffic, not
intent. Zero calls in 120 days is equally consistent with "nobody uses this" and "a flow
exists and hasn't fired yet." That is a question for you, not a guess for us.

When you want it, here is the honest shape of the change:

- It is **one API call** to point the calls at our own handler, and **one API call** to put
  it back. The current settings are written down, so it is fully reversible.
- It stops the loop immediately — our handler answers and does not dial the number back.
- Nothing places outgoing calls from this number, so nothing outbound depends on it.
- If a live Playboxxx call flow *does* expect calls here, it starts failing **visibly, in
  our logs**, instead of silently in a system we cannot see. That is a better failure than
  the one we have now.
- Leaving it: the loop fires again on the next call in, including wrong numbers and
  robocallers. 120 days of it cost 53 cents. Nothing stops a third event.
