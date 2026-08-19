# Transactional SMS — number provenance & test-endpoint exposure

Date: 2026-08-19. Read-then-fix pass following Group B/C conversion.

## 1. tt-deliverability-test — was it ever hit?

The pre-gate version sent, on every unauthenticated request,
`From +18776818621 → To +19174643048` (hard-coded handset), body prefix
"TopTier outbound delivery test from GasMask 877".

Twilio Messages API, scanned week-by-week from 2026-04-30 to 2026-08-20 for
that destination:

| Metric | Value |
|---|---|
| Messages matching the test body | **1** |
| Date | 2026-06-03 12:11:36 UTC |
| Status / price | delivered / $0.0083 |

That single hit is the authoring invocation. **No abuse, total exposure $0.0083.**
The endpoint is now admin/owner gated, the destination must be supplied by the
caller, and the send routes through `_shared/twilioSend.ts` (class `test`) so it
leaves the same audit row as production traffic.

## 2. send-invoice-receipt — where did the numbers come from?

`invoice_receipt_log` holds 136 receipts with a real destination.
Matching last-10 digits against each store's own line and its `store_contacts`:

| Bucket | Count |
|---|---|
| Total receipts | 136 |
| Destination equals the store's own `store_master.phone` | 117 |
| Destination matches a `store_contacts` row **and not** the store line | **21** (16 distinct contacts, 13 stores) |

So the fallback is **non-zero**. Roles of the 21: `worker` 17, `additional` 1,
`Inactive` 1, `MANAGER` 1, `WORKER` 1. None of the 16 contacts has
`sms_opt_in_at` set, and none is `is_primary`. These numbers were captured
during field visits for ops contact, not for billing.

### Named list (contact / role / store / receipts / dates)

| Contact | Role | Store | Receipts | Dates |
|---|---|---|---|---|
| Unknown | worker | BRO DELI (8123 Flatlands 2nd St) | 2 | 2026-02-26 |
| Unknown | worker | Flatlands mini market (104-24 Flatlands Ave) | 2 | 2026-02-26 |
| Scatt | worker | Ave L Superette (8821 Avenue L) | 2 | 2026-02-19 |
| "+ (104-24 flatlands Ave) Flatlands mini market" | worker | Flatlands mini market | 2 | 2026-02-26 |
| Prince | worker | Canarsie Deli (9801 Avenue L) | 2 | 2026-02-19 |
| Kash | MANAGER | RAMMI / Abdul / Frankie (22506 Jamaica Ave) | 1 | 2026-07-24 |
| sean | WORKER | RAMMI / Abdul / Frankie | 1 | 2026-03-12 |
| Unknown | worker | Ali (8404 Flatlands Ave) | 1 | 2026-02-19 |
| Unknown | worker | Jay - Ali Aden Super Market (104-04 Flatlands Ave) | 1 | 2026-02-19 |
| Unknown | worker | Jose Deli & Grocery (627 Blake Ave) | 1 | 2026-02-16 |
| "+ (104-04 flatlands ave) Ali Aden super market" | worker | Jay - Ali Aden Super Market | 1 | 2026-02-19 |
| Unknown | worker | Taha Deli & Grill (8010 Flatlands Ave) | 1 | 2026-02-26 |
| "+ (8010 FLATLAND AVE) TAHA" | worker | Taha Deli & Grill | 1 | 2026-02-26 |
| Curly Radeef deli & grocery | worker | Jose Deli & Grocery | 1 | 2026-02-16 |
| "ders. / / Name Sammy Phone" | additional | Jay - Ali Aden Super Market | 1 | 2026-02-19 |
| john | Inactive | 538 Hegeman Ave / MOHAMMED | 1 | 2026-02-19 |

Most are Feb 2026; the latest is 2026-07-24 (Kash, MANAGER). The volume is
small but the path is live, and a manager receiving an invoice is a different
consent than an owner receiving one — a worker receiving one is not defensible
at all.

### Retroactive action on the 21 already sent — none, deliberately

Stated explicitly so the next reader does not have to infer it: **no
notification, apology, or deletion is owed for the 21 receipts already
delivered.** The content was a billing receipt for the store the recipient
worked at — transactional, not marketing, no personal data about the recipient,
no financial exposure to them, and nothing that triggers a notice obligation.
The finding is a consent-hygiene defect in how the destination was chosen, not
a harm event. The fix below is forward-only and that is the complete remedy.

**One exception worth naming separately.** One of the 21 went to `john`, role
`Inactive`, at 538 Hegeman Ave / MOHAMMED, on 2026-02-19 — a person who no
longer worked at the store received that store's billing information. That is a
different failure from the other twenty: not "wrong person at the business" but
"person outside the business". Still a single receipt, still no action taken,
but it is the one that would have mattered had the volume been higher, and it
is the reason the role filter alone is not the whole lesson — a stale contact
with a billing-shaped role would pass the new filter. Contact staleness is not
currently modelled anywhere; recorded here as the open gap.

### Fix applied

`send-invoice-receipt` no longer takes "oldest contact with a phone". The
`store_contacts` fallback now requires `is_primary = true` or a billing role
(`owner`, `billing`, `manager`, `accounting`); otherwise it is skipped and the
store's own line is used. Also removed a read of `store_master.contact_phone`,
a column that does not exist — see section 6.

## 3. profiles.phone / auth.users.phone — decision recorded

`brandaro-stripe-webhook`, `dd-stripe-webhook` (referrer notice) read
`profiles.phone`; `dd-subscription-fulfillment` reads `auth.users.phone`.
These are **account-level** numbers the customer supplied to their own account,
and the messages are order/subscription updates on that account.
**Decision: leave as-is.** Recorded here so it is a decision, not an assumption.
If any of these ever carries marketing content, the class changes and the number
source must change with it.

## 4. Stripe idempotency

The four webhook handlers converted in this pass (`brandaro-stripe-webhook`,
`dd-stripe-webhook`, `demo-stripe-webhook`, `ut-send-booking-confirmation`) now
pass a deterministic `idempotencyKey` derived from the Stripe object id, so a
provider retry re-uses the existing `outbound_messages` row instead of sending a
second receipt.

## 5. Process note — the rules index steered the work wrong

The memory index line for SMS routing still said transactional/workforce belonged
in `twilioSend`, which contradicted the guardrail architecture it was written to
describe. Nine functions were converted the wrong way before the contradiction
was caught mid-pass and re-routed. Same failure shape as a docstring advertising
a feature that does not exist, except an index is read *before* the code and so
actively directs work. Rule: when a summary and the system disagree, the summary
is the defect — fix it in the same commit that discovers it, before continuing.

## 6. `store_master.contact_phone` — and a sweep for the same shape

The receipt resolver ended in `?? store.contact_phone`. That column has never
existed on `store_master`. The chain was written to *guarantee* a destination,
and its guarantee step was inert — the only reason it never bit is that an
earlier step always matched. Same family as an `expand` that returns zero: a
fallback that cannot fire is indistinguishable at runtime from one that was
never needed.

So the check was run across the whole backend: every `?? someRow.column`
fallback in `supabase/functions/**`, tied to the nearest preceding
`.from("table")`, validated against `information_schema.columns` on the live
database.

- 114 fallback sites matched a table.
- After discarding matches where the left side is a JSON payload, Stripe
  object, or config blob rather than a DB row (`prefs`, `body`, `call`,
  `session`, joined aliases), **one live resolution chain had the same defect**:

  `brandaro-receptionist-checkout` selects `*` from `brandaro_qualified_leads`
  and then resolves
  `lead.contact_email ?? lead.owner_email`, `lead.owner_name`, and `lead.phone`.
  None of those four columns exist on that table. Real columns are `email`,
  `full_name` / `first_name`, `phone_number`. Every dead tail sat *after* a step
  that always matched, so nothing ever surfaced — identical to `contact_phone`.

  Fixed: the chains now reference only columns that exist, with `full_name`
  added as the real intermediate name fallback.

The remaining flagged pairs are heuristic false positives (nearest-`from`
attribution onto non-row objects) and were checked by hand, not dismissed.

**Standing check.** Any resolution chain whose purpose is to *guarantee* a
value must have every step validated against the live schema when written. A
`select("*")` plus optional chaining will never tell you a step is dead.
