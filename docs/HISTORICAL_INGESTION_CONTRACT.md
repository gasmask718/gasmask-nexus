# Historical Ingestion Contract

Effective: 2026-06-03. Pre-flight build complete; David's Excels/notepads can now be staged → reviewed → committed.

## The 5 Pre-Flight Steps (shipped)

### 1. `invoices.business_date` (the truth column)
- `date NOT NULL DEFAULT CURRENT_DATE`, indexed `(business_date)` and `(store_id, business_date)`.
- Backfilled for all existing rows: `business_date = created_at::date`.
- Views rebuilt to bucket d30 / d90 / MTD / prior_month by **business_date** (lifetime totals unchanged):
  - `v_invoice_effective_tubes` — exposes `invoice_date` as `business_date`.
  - `v_store_tube_summary` — all period buckets keyed off `business_date`.
  - `v_tubes_sold_per_store_per_day` — `sale_date` = `COALESCE(invoice.business_date, ledger.created_at::date)`.
  - `v_tube_bag_ratio_per_store` — lifetime-only aggregator; no date buckets; left as-is.
  - Dependents rebuilt verbatim: `v_neighborhood_tube_intel`, `v_reactivation_targets`.
- **Identity verified**: dashboard fingerprint `c7dad073c2f031b942bebd5ba7da6273` (lifetime=128259, d30=0, d90=54, mtd=0, prior_month=0, 2138 rows) — IDENTICAL before/after the rewrite.

### 2. Additive columns
- `store_notes.source text` — tag origin (e.g. `historical_import_2026_<batch>`).
- `store_master.is_historical boolean DEFAULT false` — partial index where true.

### 3. Staging tables (all RLS-enabled, authenticated full access)
`import_stores_staging`, `import_invoices_staging`, `import_contacts_staging`, `import_notes_staging` — each carries `import_batch_id`, `source_row_num`, `source_file`, `raw_payload jsonb`, `match_status`, `matched_id`, `candidate_ids`, plus reviewer columns.

### 4. Match RPCs (read-only; never mutate canonical)
- `match_import_stores(batch)` → phone-exact → address-fuzzy → name+city-fuzzy. Returns `exact | ambiguous | none` + candidate ids.
- `match_import_invoices(batch)` → sha256 composite `(store_id | business_date | total_amount | sorted line hashes)` vs existing invoices.
- `match_import_contacts(batch)` → `(store_id, normalized_phone)`.

### 5. Commit RPC + Review Queue
- `commit_import_batch(batch_id, committed_by)` — batches **≤100**, per-row try/catch, every insert id logged to `historical_invoice_repairs` for reversibility, returns row-level pass/fail.
- All canonical inserts force `is_historical=true`, `business_date=<real date>`, `source='historical_import_2026_<batch>'`.
- Skips rows where `reviewer_decision='skip'`; treats `exact` as duplicate unless reviewer chose `create_new`.
- Review UI: `/admin/historical-import` — ambiguous/none rows require human pick (`use_existing` / `create_new` / `skip`). **Nothing auto-merges.**

## CONTRACT — for ALL future code

**Any new trigger/function/edge that observes `invoices` (commission events, push notifications, "new store welcome" automations, "recent activity" feeds, dispatch nudges, etc.) MUST short-circuit on `is_historical = true`.**

Pattern:
```sql
IF NEW.is_historical THEN RETURN NEW; END IF;
```

What is allowed on historical rows:
- Lifetime totals INCLUDE them (correct — they are real sales).
- Period dashboards (MTD / D30 / D90 / prior_month) bucket them by `business_date`, so a 2025 invoice falls into 2025 buckets naturally.
- `trg_store_master_seed_brands` may seed brand chips for historical stores — **intentional**, leave on.

What is forbidden on historical rows:
- No notifications, no SMS, no "welcome" sequences.
- No commission events / payout ledger entries.
- No "recent activity" or "fresh sale" feed entries.
- No stock decrements (inventory was consumed long ago).

## Post-Commit Assertions (run after every batch)
1. `imported_count = staged_count - skipped_count`
2. For 5 random stores: `lifetime_delta = SUM(imported_tubes_for_store)`
3. `current_month_buckets_did_not_spike` — MTD totals before/after differ by ≤ MTD of imported invoices whose `business_date` falls in current month (should normally be 0).
