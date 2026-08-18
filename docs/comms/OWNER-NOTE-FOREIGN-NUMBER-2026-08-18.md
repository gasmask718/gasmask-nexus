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

**1. The number calls itself in a loop.**
When someone phones it, the Playboxxx system answers by phoning the same number again.
(Correction added 2026-08-18 after the recordings audit: the caller's own number is carried
down each generation of the loop, so Twilio logs all 42 legs as *inbound calls from the two
original callers*, not as calls the number placed. The behaviour is the same; the billing
and the recordings are the same. Detail in RECORDINGS-AND-VOICE-LOOP-18883022514-2026-08-18.md.)
It has done this twice that we can see: **6 August** and **13 August** — 42 call legs in
total, most of them inside a few seconds. Cost so far: **$0.53** over 120 days, 69 seconds
of billed time. The money is trivial; the point is that it fires by itself and will fire
again whenever anyone dials the number, including wrong numbers and robocallers.

It cannot be stopped without either changing the call handling (which means touching
Playboxxx's setup) or giving the number up. There is no third lever.

**2. It records calls, and we cannot hear the recordings.**
Every one of those calls was recorded in stereo — both sides of the conversation — and
stored inside the Playboxxx system. **18 recordings** exist that were billed to us.
We have no way to play them, review them, or delete them. There is also no
consent step anywhere in that flow, which matters in the states that require both
people on a call to agree to being recorded. This is the finding worth escalating.

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
