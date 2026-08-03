# AR Recovery + Date Correction — Revised Plan

Approved sequence, amended per Move 1 and Move 2. AR findings below are report-only, run read-only.

---

## MOVE 2 — AR RECOVERY REPORT (this is the headline)

### a. Current payment state: every one of the 1,352 enrichment invoices is at raw default

| field | value across all 1,352 |
|---|---|
| `payment_status` | `'unpaid'` — 1,352 / 1,352 (column default) |
| `amount_paid` | `0` — 1,352 / 1,352 (column default) |
| `partial_amount` | `NULL` — 1,352 / 1,352 |
| `paid_at` | `NULL` — 1,352 / 1,352 |

The enrichment run never wrote a single payment field. Total face value: **$83,565**, all of it sitting in AR as unpaid.

**The AR is wrong in both directions, and the larger error is the overstatement:**

- **659 invoices, $30,210** have notes saying PAID with no outstanding language. This is **phantom AR** — money already collected, still showing as owed. Any aging report or collections list is chasing it.
- **508 invoices, $32,943** have notes indicating a partial or unpaid balance. Genuinely outstanding, but flagged by accident rather than by record.
- **177 invoices, $19,862** have no payment language at all. Unknown state.

So of $83,565 in apparent AR, roughly **36% is already collected** and the "unpaid" status is meaningless as a signal today — it's the default value, not a fact.

### b. Outstanding balance

| measure | count | dollars |
|---|---|---|
| Invoices with unpaid/owe/balance language | **508** | **$32,943** invoice face value |
| — of those, with an explicit figure in the note (`owe 100`) | 62 | parseable to an exact balance |
| — of those, outstanding but no figure given | 446 | balance must be inferred or field-verified |
| — of those, `total_amount` is NULL entirely | 144 | no invoice value recorded at all |
| Distinct stores affected | **234** | |

Important caveat: **$32,943 is invoice face value, not the balance owed.** Notes like "1 box -200 $ paid 100 dollars owe 100 unpaid" mean the invoice is $200 but only $100 is outstanding. The true recoverable figure is lower than $32,943 and can only be pinned down for the 62 rows with explicit figures until the rest are parsed or field-verified. Treat $32,943 as the upper bound.

### c. Stores ranked by outstanding exposure

| store | invoices | face value | rows w/ NULL amount | explicit owe figure |
|---|---|---|---|---|
| US Quick Mart | 4 | $5,400 | 1 | 0 |
| Seven Express Deli inc | 19 | $1,500 | 6 | 2 |
| EBB Pitkin Express Deli Grill | 14 | $1,360 | 3 | 4 |
| happy land convenience | 11 | $930 | 2 | 1 |
| Blake Express Deli | 9 | $880 | 0 | 1 |
| Abdula two deli Ang grill burgers | 5 | $701 | 0 | 2 |
| Beans (165 9th Ave) | 2 | $700 | 0 | 1 |
| Mike's Finest deli grocery corp | 8 | $700 | 4 | 2 |
| Fetty KJ | 9 | $700 | 3 | 2 |
| Polanco Anthony | 9 | $652 | 3 | 4 |
| Ave L superette inc | 8 | $650 | 0 | 0 |
| snack station | 5 | $600 | 0 | 0 |

Long tail: 234 stores total, so the top 12 are a small slice. US Quick Mart is the standout — $5,400 across 4 invoices, four times the next account.

**Assessment:** there is real uncollected money here, but the more urgent defect is the $30,210 of phantom AR. Chasing stores for invoices their notes say were already paid is an active relationship risk for the field team. Both directions get fixed by the same parse.

---

## MOVE 1 — STEP 5 SPLIT: DATES FIRST

**5a. Date parse and report.** Extract the date written in `invoices.notes` for all 1,352 enrichment rows (plus the legacy CRM lane). Report coverage split three ways: clean parse, ambiguous, malformed.

**Malformed dates get no guess.** "0/1/25" and "0/27/25" carry month zero. Those rows keep their current `business_date` untouched and are flagged for review. Same for any date that parses to a future date or predates the business. A known-unknown beats a wrong date.

**5b. Ship the date correction** on the high-confidence subset only, after the coverage report is reviewed. This unblocks the Last Order card, stale-account logic and aging — 1,275 invoices currently claim 2026-07-15 while their notes say early 2025, so bikers are seeing dormant stores as recently active.

**5c. Line reconstruction parse** — separate pass, after dates land, and after the AR pass below.

### Ordering inside step 5

Because the AR report shows payment state is fully defaulted, the payment parse rides with the date parse rather than waiting for line items. Sequence: **dates → payment state → line items.** Payment state is a per-invoice scalar like the date; it does not need line items to exist.

## PARSER GUARDRAILS (apply to 5a, 5b and 5c)

- Parse into a **staging table** with the raw note stored in the same row beside every parsed field. Nothing writes directly to `invoices` or `invoice_line_items` from the parser.
- **Confidence tiers** on every parsed field independently — a row can have a high-confidence date and a low-confidence quantity. Anything ambiguous goes to a review queue, never to the backfill.
- **50-row eyeball gate before any full run.** Side-by-side output: raw note next to parsed date, product, qty, unit, amount, paid state, plus the confidence tier for each. No run over the full 1,352 until that sample is approved.
- **`invoices.notes` is never modified or cleared.** It is the only source and it stays intact permanently, including after reconstruction succeeds.

## LEGACY CRM DUPLICATE QUEUE

172 groups / $51,955, **ranked by dollar amount descending** so the largest get reviewed first. No automated deletion.

The queue treats "not a duplicate" as a first-class outcome, not an exception — same store + same date + same amount is legitimately common here (two sales in a day, a recurring $100 account). One click to dismiss, the dismissal persists so the group never resurfaces, and the reviewer sees both invoices' notes side by side to make the call.

## STEP 8 TIMING — open question

Fixing the four header-only import writers (`useBulkUpload`, `BulkInvoiceUploader`, `commit_import_batch`, `ai-backfill-runner`) sits at step 8 as written. **If a bulk upload is planned in the next two weeks, it moves ahead of reconstruction** — otherwise the next upload writes a fresh batch of lineless, default-payment, wrong-date headers into a set we're mid-repair on, and the parser has to run twice.

Tell me if an upload is coming and I'll reorder; otherwise it stays at 8.

---

## FULL SEQUENCE

1. `products.units_per_box` default 24 → NULL
2. DNC end-to-end synthetic STOP test
3. Wrapper: `allowZero` + `select('id')` default projection
4. Prebuild gate on unverified mutations
5. **5a** date parse + coverage report → **5b** date correction on high-confidence subset → **5c** payment-state parse and correction (phantom AR first)
6. Unit-column migration (`sale_unit` canonical, 125-row relabel, 4 drift rows)
7. Line reconstruction from staging, high-confidence only, remainder queued
8. Fix the four import writers *(moves ahead of 7 if an upload is scheduled)*
9. Legacy CRM duplicate review queue, ranked by dollars
10. Last Order card, `/flower-customers`, InvoiceBuilder
11. Backlog mutation migration — money and field-rep tables first

Brand-header work stays parked.
