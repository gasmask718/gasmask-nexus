# Ingestion Lanes

**Status:** Canonical. Three lanes, three schemas, three validators. **Never merge.**

The OS ingests external data through three strictly separated lanes. Each has its own source, schema, validator, and downstream owner. Mixing them corrupts the working prospect universe (2,145/438/1,707 — see Post-Dedup Store Counts memory) and is forbidden.

## Lane 1 — Places Discovery

- **Source:** Google Places API via `gm-neighborhood-scan` + Territory Ingestion Engine
- **Staging table:** `gm_discovered_pois`
- **Schema highlights:** `name`, `formatted_address`, `place_id` (unique), `lat`, `lng`, `categories[]`, `phone`, `website`, `scan_id`
- **Validation:** Google `place_id` must be unique; missing phone routes into sequential enrichment queue; geocode must resolve before promotion
- **Promotion path:** `request_store_promotion` RPC → `stores` (CRM) **only after** human/AI scout review
- **Owner:** Territory team, GasMask routing, Scout Console
- **Authoritative read view:** territory prospect pages (VisitConsole, ScoutConsole, TerritoryCandidates, GapIntelligence) — pre-CRM addresses, **never dispatch directly**

## Lane 2 — CSV Contacts Import

- **Source:** operator-uploaded CSVs (manual, partner lists, event sign-ups)
- **Staging tables:** `import_contacts_staging`, `import_stores_staging`, `crm_imports` / `crm_import_logs`
- **Schema highlights:** raw row, mapping config, row_hash, validation_errors[], import_batch_id
- **Validation:** column mapping via `data_import_mapping`; required fields per target table; row_hash dedup against existing CRM; phone normalization to E.164
- **Promotion path:** explicit operator approval per batch → target CRM table (`crm_customers`, `crm_partners`, `companies`)
- **Owner:** CRM admins, Partners Import page, Historical Import Review

## Lane 3 — Historical Invoice Repair

- **Source:** legacy invoice data that pre-dates the canonical schema
- **Staging tables:** `import_invoices_staging`, `audit_invoice_drafts`, `historical_invoice_repairs`, `historical_invoice_line_repairs`, `legacy_invoice_price_map`, `merge_invoice_repoint_log`
- **Schema highlights:** original_invoice_id, repair_reason, before/after snapshots, repoint_target_invoice_id
- **Validation:** every repair must compensate (no destructive edits — Ledger Truth standard); price reconciliation against `legacy_invoice_price_map`; line-level totals must match repaired header
- **Promotion path:** `finalize_invoice` RPC (immutable record creation) after audit pass
- **Owner:** Finance admins, Legacy Invoice Repair page

## The non-merge rule

| | Places Discovery | CSV Contacts | Historical Invoice Repair |
|---|---|---|---|
| Identity key | `place_id` | `row_hash` | `original_invoice_id` |
| Promotes to | `stores` | `crm_*` | `invoices` (compensated) |
| Validator | geocode + phone enrichment | column mapping + dedup | reconciliation + audit |
| Failure surface | Scout Console | Historical Import Review | Legacy Invoice Repair |

**Never:**
- Promote a Places POI directly through the CSV path (skips Scout review and phone enrichment)
- Repair a historical invoice by re-importing a CSV (bypasses compensating entry rule)
- Treat a CSV contact as a discovered POI (no `place_id`, no geocode contract)

Each lane has its own provenance audit; cross-lane writes break the audit chain and are rejected at the RPC layer.
