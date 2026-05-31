# A2P 10DLC Registration Plan

US carriers (T-Mobile/AT&T/Verizon) drop any A2P SMS sent from an unregistered
US long code. Symptom: Twilio returns `201 queued`, final status is
`undelivered` with error `30034`. Phone never rings. This is what happened with
`SM568cd60a7f1707e4cf48a162166b2321` on `+19292623850 → +17183089391`.

## Registration order (must be this order)

```
Brand (legal entity, EIN)
  └── Campaign (use-case, sample messages, opt-in flow)
        └── Messaging Service (Twilio resource)
              └── Numbers attached (the long codes do the actual sending)
```

You send via `MessagingServiceSid`, NOT `From`. Twilio picks an attached number
from the pool and stamps the campaign metadata onto the carrier handoff.

## Recommended Brand → Campaign → Service structure

### Brand 1 — GasMask (main account `AC5833…1783`)

One Standard Brand (Sole Proprietor brands are limited to 1 campaign / very low
TPS — not enough for fleet ops). EIN required.

| Campaign | Use case | Numbers (count) | Why separate |
|---|---|---|---|
| `GasMask – Customer Care` | Account notifications, support replies, order/dispatch updates | DC long codes used for 1:1 ops (~15) | Highest deliverability tier, no marketing content |
| `GasMask – Marketing / Outreach` | Cold/warm prospecting, promos, blasts | DC long codes used for bulk outreach (~5) | Marketing campaigns get stricter throughput + content review; isolating keeps Care clean |

If outreach volume is <2k/day across all numbers, you can collapse these into a
single `Mixed` campaign — but keep separate Messaging Services so we can rate-
limit/route per use case in code.

### Brand 2 — Brandaro (account `AC5833…` — same Twilio account, second brand)

Brandaro is a different legal entity / DBA → register as its own Brand under the
same Twilio account.

| Campaign | Use case | Numbers (count) |
|---|---|---|
| `Brandaro – Lead Gen` | VA outreach, demo follow-ups, appointment confirms | 15 Brandaro long codes |

One campaign is enough for 15 numbers at current volume.

### Final structure

```
Twilio Account AC5833…
├── Brand: GasMask LLC (EIN xx-xxxxxxx)
│   ├── Campaign: Customer Care   → MG_gasmask_care   → 15 DC numbers
│   └── Campaign: Marketing       → MG_gasmask_mktg   → 5  DC numbers
└── Brand: Brandaro (EIN xx-xxxxxxx)
    └── Campaign: Lead Gen        → MG_brandaro_lead  → 15 Brandaro numbers
```

After approval, store the three Messaging Service SIDs and route per
brand/use-case in `send-sms` (replace the single `TWILIO_MESSAGING_SERVICE_SID`
env var with a resolver that picks based on `From` or `campaign_id`).

## Checklist — what David needs to gather

### Per Brand (one set per legal entity — GasMask and Brandaro)

- [ ] Legal business name (exactly as on IRS filing)
- [ ] EIN (9 digits)
- [ ] Business type: LLC / Corp / Sole Prop / Non-profit
- [ ] Country of registration (US)
- [ ] State of registration
- [ ] Registered business address (street, city, state, ZIP)
- [ ] Business website URL (must be live, must reference the brand)
- [ ] Vertical / industry (e.g. Retail, Logistics, Marketing)
- [ ] Stock exchange + ticker (if publicly traded — N/A for both)
- [ ] Authorized contact: name, email, phone, title

### Per Campaign

- [ ] Use case (Customer Care / Marketing / Mixed / 2FA / etc.)
- [ ] Description (1–2 sentences: what messages do you send, to whom, why)
- [ ] **2–5 sample messages** (real templates, include `{{name}}` placeholders;
      one must contain opt-out language: "Reply STOP to unsubscribe")
- [ ] **Opt-in flow** — how recipients consent. Options:
  - Web form (provide URL + screenshot)
  - Verbal at point of sale
  - Existing customer relationship (must describe)
- [ ] Opt-in confirmation message (the auto-reply sent on first consent)
- [ ] Help message (auto-reply to HELP keyword)
- [ ] Embedded links? Y/N + sample
- [ ] Embedded phone numbers? Y/N
- [ ] Age-gated content? N
- [ ] Direct lending? N
- [ ] Affiliate marketing? N

## Cost + timing

- Brand registration: $4 one-time + $44/yr (Standard Brand vetting)
- Campaign registration: $15 one-time + $10/mo per campaign
- Approval: 1–3 business days for Brand, 1–3 for Campaign (can fail review;
  most common rejection = vague opt-in flow or sample messages without STOP)

## After approval — code change

`send-sms` currently reads a single `TWILIO_MESSAGING_SERVICE_SID`. Once we have
three, replace with:

```ts
function resolveMessagingService(fromNumber: string, campaignKind?: string) {
  if (BRANDARO_NUMBERS.has(fromNumber)) return Deno.env.get("MG_BRANDARO_LEAD");
  if (campaignKind === "marketing")    return Deno.env.get("MG_GASMASK_MKTG");
  return Deno.env.get("MG_GASMASK_CARE");
}
```

Then `form.append("MessagingServiceSid", resolved)` and DROP the `From` param —
Twilio picks the number from the service's pool.

## Until then — pre-send guard (installed)

`send-sms` now refuses to send to any `+1` destination unless
`TWILIO_MESSAGING_SERVICE_SID` is set OR `TWILIO_A2P_BYPASS=true` is set
(for verified test numbers only). Failed sends return
`error_code: "A2P_UNREGISTERED"` with a clear message and are logged to
`outbound_messages.status='failed'` — no more silent 30034 drops.
