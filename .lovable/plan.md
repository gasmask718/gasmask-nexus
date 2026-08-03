# Findings + Revised Plan

All answers below come from queries run just now. No code was changed.

---

## STEP 2 — Characterizing the 2,771 lineless invoices

**a. Money.** 2,193 shells carry a non-zero total; 578 are zero. Total on lineless headers: **$424,520.51**. Median $100, max $61,325. This is not a stub population.

**b. Status / finalized split.** Three distinct populations, not one bug:

| population | n | money | signature |
|---|---|---|---|
| Legacy CRM import | 1,337 | $210,645 | `entry_mode=live`, `is_historical=false`, `status=finalized`, `finalized_at` NULL, `created_by='Gas mask crm'` |
| AI enrichment run | 1,352 | $83,565 | `entry_mode=ai_enrichment`/`live`, `is_historical=true`, `status=draft_ai`, `enrichment_run_id` set |
| Backfill | 54 | $129,438 | `entry_mode=backfill`, `is_historical=true` |
| Genuine live drafts/finalized | 28 | ~$872 | ordinary app writes |

Only **26 of 2,771** have `finalized_at` set. The 1,337 "finalized" legacy rows have status text but no finalization stamp — they were imported with the string, not finalized by the app.

**c. Created-date histogram.** Not a datable regression — two import spikes plus a long tail:
- 2024-09: 393, 2024-10: 385 (legacy CRM migration, $134k combined)
- 2026-07-15: 1,352 in a single day (the AI enrichment run)
- everything else: 3–161/month spread across 2024-11 → 2026-07

**d. Signature.** `created_by` is one of two values for 96% of shells: the literal text `'Gas mask crm'` (legacy import) or user `6019a316…`. `order_id` is NULL on **all 2,771**.

**e. Visit correspondence — ruled OUT, decisively.** `visit_logs` has **0 rows in the entire table**. `route_stops` has 17. Zero shells match a visit on the same day. Nothing is auto-creating a header per visit. There is no "missing filter" explanation.

**Conclusion.** This is not an app bug and there is no live regression writing lineless invoices. It is **imported header-only history**: $210k of legacy CRM invoices and $83k of AI-enriched drafts that never had line detail to begin with. The correct response is classification, not repair — the fix is a `line_detail_available` flag (or reusing `is_historical` + `status`) so the UI and the Last Order snapshot can say "header-only, imported" instead of rendering an empty sale. Repairing them is impossible: the detail was never captured.

The one thing that *is* a real bug here: **`visit_logs` is empty while 25 code sites reference it and 6 write to it.** That is a live silent write loss on field-rep activity. See the sweep below.

---

## SNAPSHOT DRIFT — all 4 rows, individually

The earlier "7" was a grouped double-count. There are **4** drifted line items, and they are all the same failure:

| line item | sold | product | snapshot `units_per_box` | product now | sale_unit |
|---|---|---|---|---|---|
| f740f959 | 2026-07-16 | GasMask Bags | **1** | 100 | unit |
| cc013f28 | 2026-07-16 | GasMask Tubes | **1** | 100 | unit |
| 6453e931 | 2026-07-16 | GasMask Redtops | **1** | 100 | unit |
| db1e48c9 | 2026-07-24 | GasMask Tubes | **1** | 100 | unit |

**Verdict: all 4 captured a misconfiguration, none captured a genuine historical value.** Proof: every one of these products was created (2025-11/2025-12) with `units_per_box=100` and has never had a box size of 1. The snapshot value `1` is a write-time fallback, not history. All 4 are safe to correct to 100.

They are currently inert — `sale_unit='unit'`, so `computed_tubes_total` equals quantity and is right either way. They only become wrong the moment something converts them as boxes. Fix them before the builder ships.

---

## CANONICAL UNIT COLUMN — proposal

**Make `sale_unit` canonical. Make `unit_type` derived.**

Rationale: `sale_unit` already carries the truth on every live row, it is lowercase and consistent, and the builder needs exactly two states (`box` / `unit`). `unit_type` is free text with mixed casing and 125 wrong rows.

Mechanism: a `BEFORE INSERT OR UPDATE` trigger sets `unit_type = upper(sale_unit)` (→ `BOX` / `UNIT`), so legacy readers keep working and drift becomes structurally impossible. The builder writes `sale_unit` only and never touches `unit_type`. This also *is* the Step 4 relabel — the 125 wrong rows get corrected by a one-time backfill using the same expression, so the two pieces of work collapse into one migration.

Confirm this and I'll write it.

---

## OUTSTANDING ANSWERS

**Brand header split (the condition).** Of the 1,405 invoices with a null/blank brand header, essentially all are in the shell population — and shells have no line items at all, so there is nothing to repartition from. Repartitioning recovers brand for the ~395 invoices that *do* have lines, not for the 1,405. **The condition fails.** The brand-header work stays parked, `brandSummary` keeps being written, and the v2 view is not built. Agreed with your call.

**184 live TUBE rows priced at box price.** Query pending — this needs the per-store and per-surface breakdown you asked for, delivered as a report with a proposed backfill script that is not executed. Scheduled as its own step, after the unit-column migration so the corrected `sale_unit` is the join key.

**Odd `units_per_box`.** `computed_tubes_total` is `numeric`. Recommendation matches yours: **block half-box on odd counts** in the builder rather than round or floor, and surface the reason inline.

**Readers of `v_store_last_order_snapshot`.** To be enumerated in the same report; the known consumer is `LastOrderKPIBadge.tsx`.

---

## WRAPPER FIXES (both accepted)

- `allowZero?: boolean` option on `verifiedUpdate`/`verifiedDelete`. When set, zero rows is a success and no error is thrown.
- Default projection changes from `select('*')` to `select('id', { count: 'exact' })`. A `returning` option keeps `'*'` available where the caller needs the row back.

## STOP THE BLEEDING — feasible, yes

This project already runs a `prebuild` gate (`scripts/check-sidebar-routes.mjs`, `scripts/check-public-view-grants.mjs`) plus ESLint 9 flat config. Two options, and I recommend both:

1. **Baseline script** `scripts/check-verified-mutations.mjs`, added to `prebuild`. It counts unverified `.update(`/`.delete(`/`.insert(` call sites and fails if the count exceeds a committed baseline number. The count can only go down. This is the fastest path and needs no plugin authoring.
2. **ESLint rule** (custom local rule in the flat config) flagging a Supabase mutation call not followed by `.select(` and not routed through `verifiedMutation`. Set to `warn` initially so it doesn't break the build, promoted to `error` once the backlog is under control.

## FIND WHAT'S ALREADY BROKEN — sweep complete

Raw counts: **1,319 of 1,981 public tables have zero rows.** That number alone is not a signal — most are unbuilt features. So I cross-referenced against the codebase: tables with zero rows *that application code actively inserts into*.

**681 tables are written to by live code and contain nothing.** Ranked by number of write sites, the money / inventory / field-rep tier:

| table | write sites | why it matters |
|---|---|---|
| `visit_logs` | 6 | field-rep visit history — the Store Profile reads it |
| `inventory_movements` | 6 | stock never moves |
| `purchase_order_items` | 6 | PO lines never persist |
| `dnc_list` | 8 | **compliance** — do-not-call list is empty |
| `opt_out_events` | 5 | **compliance** — SMS opt-outs not recorded |
| `collection_actions` | 19 | AR collections activity |
| `business_expenses` | 7 | P&L inputs |
| `orders` | 5 | order writes |
| `ai_communication_queue` | 27 | outbound comms queue |
| `automation_rules` | 11 | automation never fires |
| `ambassador_activity_log` | 10 | ambassador attribution |

Full ranked list of all 681 is generated and available. The two compliance tables (`dnc_list`, `opt_out_events`) outrank everything else on risk and should be investigated first — an empty DNC list means suppression checks are passing everything.

---

## REVISED SEQUENCE

1. **One-liner now** — `products.units_per_box` default `24` → `NULL`. (Approved.)
2. **Wrapper fixes** — `allowZero`, minimal projection.
3. **Prebuild baseline gate** — stop the count growing.
4. **Unit-column migration** — `sale_unit` canonical, `unit_type` derived by trigger, 125-row relabel + 4 drift rows corrected in the same migration.
5. **`/flower-customers`** — unblocked and independent of the brand question, which is now resolved as "parked, condition failed".
6. **InvoiceBuilder** — after step 4, per your reordering.
7. **Reports (no writes)** — 184 TUBE mispricing breakdown with proposed backfill; `v_store_last_order_snapshot` reader list; DNC/opt-out silent-failure root cause.
8. **Shell classification** — flag header-only imports so the UI stops rendering them as empty sales.
9. **Backlog migration** — invoices, invoice_line_items, payments, store_master, field_submissions, routes first; cosmetic and settings writes last.
