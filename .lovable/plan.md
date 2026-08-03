# Import Pipeline Findings + Revised Plan

Context correction accepted: invoices are an **import-first** system. 3,166 invoices, of which 28 were written by the live app. The 2,771 lineless headers are expected business history, not a bug. Everything below is re-framed around that.

---

## 0. COMPLIANCE CHECK (first, as directed) — clean, with one caveat

`dnc_list` = 0 rows. `opt_out_events` = 0 rows. Both read gates are wired and **fail closed** (`_shared/dnc.ts` returns `blocked: true` with reason `suppression_lookup_failed` on lookup error), so an empty table is not silently permissive.

The question was whether they're empty because nobody opted out or because writes are lost. Evidence:

- Inbound message corpus scanned for STOP / UNSUBSCRIBE / QUIT / CANCEL: **0 matches** across `brandaro_inbound_messages` (47 rows) and `messaging_messages` (0 inbound rows).
- Writers are present and plausible: `dc-bland-webhook` (4 upsert sites), `sms-inbound-webhook`, `brandaro-handle-inbound`.

**Verdict: not a silent write loss. Nobody has opted out yet.** The gates are correct. One real gap remains: no writer path has ever executed, so the write side is untested in production. Action is a synthetic end-to-end test (send a STOP through the inbound webhook against a test number, confirm a row lands and the next send is blocked), not a code fix.

---

## 1. THE IMPORT PIPELINE — every invoice-creating path

| # | Path | Type | Creates line items? | Source has line detail? |
|---|---|---|---|---|
| 1 | `src/hooks/useBulkUpload.ts` (2 insert sites, lines 1053 + 1560) | spreadsheet upload | **No — header only** | **Yes, discarded** |
| 2 | `src/components/store/BulkInvoiceUploader.tsx` (line 407) | paste / CSV, line + block mode | **No — header only** | **Yes, discarded** |
| 3 | `public.commit_import_batch` RPC | staged historical batch | **No — header only** | Yes, in `raw_payload` |
| 4 | `ai-backfill-runner` edge function (`job_type='invoices'`) | AI backfill from orders | **No — header only** | Partially |
| 5 | `finalize-audit-draft` edge function | audit draft → invoice | **Yes** | Yes |
| 6 | `ut-generate-invoice` edge function | UT bookings | header + UT lines | n/a |
| 7 | `CreateStoreInvoiceModal`, `StoreCardQuickView`, `StoreVisitEngine`, `EditStoreInvoiceModal`, `useCheckout` | live app | **Yes** | n/a |

**Four import paths could capture line detail and don't: #1, #2, #3, #4.** They account for essentially all 2,771 lineless headers. This is the actual finding — not that the shells are corrupt, but that the import writers were built header-only while their sources carried detail.

`BulkInvoiceUploader` is the sharpest case: it already has a "line mode" parser that reads structured rows, and it still collapses everything into one header.

## 2. IS THE DETAIL IN THE SOURCE? — Yes, and it is already in the database

The enrichment run wrote the source text verbatim into `invoices.notes`. Actual values:

```
"0/1/25  1 BOX $200 PAID"
"0/1/25 - 0/1/25- 50 paid 25 tubes"
"0/27/25 - 20 tubes -40$ paid"
"03/21/2025 1 box -200 $ paid 100 dollars owe 100 unpaid come back on Monday for the rest of the payment"
```

Coverage across all 1,352 enrichment invoices:

- **1,352 / 1,352** contain numeric detail
- **619** explicitly say "box" / "boxes"
- **436** explicitly say "tube" / "tubes"

**The detail was not header-level to begin with — it was captured and then discarded into a text blob.** Re-import with line capture is not just on the table, it needs no new source documents: the notes field is the source. A parser over `invoices.notes` can reconstruct product, quantity, unit and payment state for the large majority of the enrichment population, and the same approach applies to the legacy CRM lane.

This changes the Last Order card decision: don't build it against 395 invoices. Reconstruct lines first, then build it against ~1,700+.

## 3. DUPLICATE CHECK — smaller than it looks, and the enrichment number is an artifact

Exact same store + same `business_date` + same amount:

| lane mix | duplicate groups | invoices involved | redundant copies | dollars at risk |
|---|---|---|---|---|
| legacy_crm internal | 172 | 471 | 299 | **$51,955** |
| enrich internal | 160 | 417 | 257 | $26,383 |
| backfill internal | 17 | 34 | 17 | $2,590 |
| app internal | 4 | 15 | 11 | $1,056 |
| **app + backfill (cross-lane)** | 10 | 20 | 10 | **$920** |

**Cross-lane duplication is negligible — $920 across 10 groups.** The imports did not overlap each other meaningfully. That was the main risk and it is ruled out.

**The $26,383 enrichment figure is largely a false positive.** All 1,275 enrichment invoices were written with `business_date = 2026-07-15` (the import date), not the real sale date sitting in the note text. Every enrichment sale collapsed onto one date, so "same store, same date, same amount" catches genuinely distinct recurring sales. Once dates are parsed out of the notes, most of these separate.

**The legacy CRM $51,955 across 172 groups is the real exposure** and needs manual review, not an automated de-dup.

## 4. ENRICHMENT RUN TRACE

Five runs, all executed 2026-07-15:

| run | invoices | dollars | stores | notes present |
|---|---|---|---|---|
| `76316034…` | 713 | $49,471 | 206 | 713 |
| `bb220002…` | 483 | $24,021 | 100 | 483 |
| `a1c99333…` | 78 | $5,226 | 30 | 78 |
| `a17ec099…000b` | 68 | $4,322 | 12 | 68 |
| `a17ec099…000c` | 10 | $525 | 3 | 10 |

**Transcribed, not estimated.** Every row carries the raw source string in `notes`, and the amounts match the figures written in those strings ("1 BOX $200 PAID" → total_amount 200). The run copied handwritten/notepad content faithfully into a header. Two defects, both mechanical:

- **Dates dropped** — 1,275 of 1,352 got the import date instead of the date written in the note.
- **Line detail dropped** — parsed nothing out of the note into `invoice_line_items`.

Neither is a fabrication problem. Both are recoverable from data already stored.

---

## REVISED SEQUENCE

1. **`products.units_per_box` default 24 → NULL.** One line. (Approved.)
2. **DNC end-to-end test** — synthetic STOP through the inbound webhook, confirm suppression row + subsequent block. No code change unless it fails.
3. **Wrapper fixes** — `allowZero` option; default projection `select('id')` instead of `'*'`, with `'*'` opt-in.
4. **Prebuild baseline gate** (`scripts/check-verified-mutations.mjs`, joins the existing `prebuild` chain) so the unverified-mutation count can only go down. Feasible — the project already runs two such gates.
5. **Notes parser, dry run, report only.** Parse `invoices.notes` into candidate `(date, product, qty, unit, amount, paid_state)` for all 1,352 enrichment + legacy CRM rows. Output a coverage report and a confidence split. Nothing written.
6. **Unit-column migration** — `sale_unit` canonical, `unit_type` derived by trigger, 125-row relabel and the 4 drift rows corrected in the same migration. Must land before any line reconstruction writes rows.
7. **Line reconstruction**, gated on the step 5 report: backfill `invoice_line_items` and corrected `business_date` for the high-confidence subset; queue the rest for review.
8. **Fix the four import writers** (#1–#4 above) to emit line items, so the next import doesn't recreate the problem.
9. **Legacy CRM duplicate review** — 172 groups / $51,955, surfaced as a review queue, no automated deletion.
10. **Last Order card, `/flower-customers`, InvoiceBuilder** — after lines exist.
11. **Backlog migration** — invoices, invoice_line_items, payments, store_master, field_submissions, routes first; cosmetic last.

Brand-header work stays parked; `brandSummary` keeps being written.
