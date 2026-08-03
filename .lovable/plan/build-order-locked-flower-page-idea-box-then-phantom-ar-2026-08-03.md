# Build Order Locked — Flower Page, Idea Box, then Phantom AR

Sequencing accepted as non-negotiable. Items 1 and 2 are build tasks and neither is blocked. Answers to the two AR questions are below; **no further discovery is proposed ahead of the build items.**

---

## OPEN — upload timing came through blank

The UPLOAD TIMING line arrived as the unfilled placeholder `[answer here: yes or no, upload in the next two weeks]`. Default assumption unless corrected: **no upload in the next two weeks**, so the four import-writer fixes stay at their existing position rather than jumping ahead of reconstruction. Say the word if that's wrong — it only affects ordering deep in the tail, not items 1–4.

---

## AR ANSWER 1 — the parser trap, quantified

You were right to call it, and the gap is larger than expected. Counts across all 1,352 enrichment invoices:

| match method | rows |
|---|---|
| `ILIKE '%paid%'` (naive) | **1,151** |
| `~* '\mpaid\M'` (word boundary) | **800** |
| `~* '\munpaid\M'` | 436 |
| word `paid` present AND `unpaid` absent | **710** |
| `~* '\mowes?d?\M'` | 89 |
| `~* '\mbalance\M'` | 11 |
| `the rest` / `remaining` / `still` | 16 |

**The naive match overcounts by 351 rows.** Word-boundary matching is confirmed as the only correct method and is baked into the parser spec. Note the phantom-AR candidate set tightens from 659 to a stricter figure once every outstanding-signal token is excluded, not just `unpaid` — the 50-row sample will show these four counts broken out separately before anything runs.

## AR ANSWER 2 — the NULL-amount invoices: revenue IS recoverable

Correction to the earlier figure: **403 enrichment invoices have `total_amount IS NULL`**, not 144. The 144 was only the subset that also carried outstanding language.

Of those 403: **0 contain a `$` symbol.** That initially reads as unrecoverable — it isn't. The amounts are written as bare numbers:

```
"6/25/25- 200 paid"
"12/18/2024 - 1 box 200 fully paid"
"12/23/2024 - [form] 560 Remsen ave 1 box 200 fully paid"
"10/20/2024 - Updated | 2 boxes - 150 each = 300 total paid"
"9/13/2024 - 1 box -150 fully paid sold out in a week"
"8/20/2024 - [form] 2 boxes premium -300 paid up front"
```

Payment language is present on most of them — 292 say `paid`, 130 say `unpaid`, 20 say `owe`. **This is real revenue currently counted nowhere**, recoverable by a bare-number parser rather than a currency-symbol parser. The parser spec is amended accordingly: match unsigned integers adjacent to unit words (`box`, `boxes`, `tubes`) and to payment verbs, not `\$[0-9]+`.

## AR ANSWER 3 — CSV export: blocked by plan mode, queued as first action on approval

The export writes to `/mnt/documents`, which plan mode blocks. It runs the moment you approve — it is a single read-only query, no dependency on any build item. Columns: store name, address, borough, phone, outstanding invoice count, face value, count missing amount, count with an explicit owe figure, and the **full raw note text** per store, ranked by face value descending.

Top of the ranking, so collections can start before the file lands:

| store | invoices | face value | rows missing amount |
|---|---|---|---|
| US Quick Mart | 4 | $5,400 | 1 |
| Seven Express Deli inc | 19 | $1,500 | 6 |
| EBB Pitkin Express Deli Grill | 14 | $1,360 | 3 |
| happy land convenience | 11 | $930 | 2 |
| Blake Express Deli | 9 | $880 | 0 |
| Abdula two deli Ang grill burgers | 5 | $701 | 0 |
| Beans (165 9th Ave) | 2 | $700 | 0 |
| Mike's Finest deli grocery corp | 8 | $700 | 4 |
| Fetty KJ | 9 | $700 | 3 |
| Polanco Anthony | 9 | $652 | 3 |

234 stores total, $32,943 upper-bound face value.

---

## BUILD ORDER

### 1. `/flower-customers` — demand list

Not blocked. The toggle fix shipped: `store_master.sells_flowers`, `sells_flowers_note`, `sells_flowers_flagged_by`, `sells_flowers_flagged_at` all exist and are being written through `verifiedUpdate`.

Columns: store name, address, borough, primary `store_contacts` contact, phone, flagged by, flagged date (absolute — `fieldStamp()`, America/New_York), note, last visit date.

Filters: borough, flagged-by, date range. Plus search, sortable columns, server-side pagination, CSV export, row click → store profile.

Shows flagged stores including those with zero sales — this answers "who would buy," which is the targeting list. It stays permanently after flower launches; invoices will answer "who bought."

### 2. Idea & Improvement box + `/ideas`

Not blocked. Needs one table and one bucket.

- `idea_submissions` — submitter, role, title, body, page/route context, browser + viewport context, store or record context where applicable, status, priority, assignee, resolution note, timestamps. RLS: any authenticated role submits; submitters read their own; admins read and manage all.
- `idea-attachments` storage bucket with owner-scoped policies, matching the pattern already used for `funding-documents`.
- App-wide **Submit Idea** entry point available to **all roles** — admin, VA, biker, ambassador, wholesaler, client portal.
- Photo upload with **camera capture** (`capture="environment"` on mobile) plus file picker, multiple attachments.
- Automatic context capture: current route, logged-in user and role, timestamp, user agent, viewport, and the active store/record id when submitted from a profile page.
- `/ideas` management dashboard: list, filter by status/role/priority, detail view with attachments, status transitions, assignment, resolution notes.

All writes go through `verifiedMutation`.

### 3. Phantom AR correction

659 → refined by strict word-boundary matching across all four token classes. Flip the confirmed-paid set to `payment_status='paid'`, set `amount_paid = total_amount`, stamp `paid_at`.

Gates, all mandatory:
- Staging table with the raw note stored beside the parsed output. Never a direct write.
- Confidence tiers per field; anything ambiguous → review queue, never the backfill.
- **50-row side-by-side sample approved before the full run**, showing raw note next to parsed date, product, qty, unit, amount, paid state — and the four separate token counts (`paid`, `unpaid`, `owe`, `balance`).
- `invoices.notes` never modified or cleared, before or after.

### 4. Date parse + correction

Parse dates from notes, report coverage in three tiers, then correct only the high-confidence subset. **Month-zero and other malformed dates get no guess** — `business_date` stays as-is and the row is flagged for review. Unblocks the Last Order card, stale-account logic and aging for the 1,275 invoices currently misreporting 2026-07-15.

### 5. Everything else, existing order

`units_per_box` default → NULL · DNC synthetic STOP test · wrapper `allowZero` + `select('id')` · prebuild gate · unit-column migration · line reconstruction · import-writer fixes · legacy CRM duplicate queue ranked by dollars with one-click "not a duplicate" · Last Order card · InvoiceBuilder · backlog mutation migration.

Brand-header work stays parked.
