# DC lead → Power Dialer bridge — pre-implementation audit (2026-09-07)

Audit only. Nothing queued, mapped, deduped or created.

## What `outbound_call_queue` actually requires

NOT NULL: `phone_number`, `status` (default `queued`), `business_id` (defaults to GasMask), `created_at/updated_at`.
Nullable but functionally required by the dialer: `campaign_id` (the fetch filters on it), `store_id`, `contact_id`.
Useful existing columns for provenance: `entity_type` (default `'store'`), `entity_id`, `source_reason`, `notes`.
So a DC lead **can** be inserted with no `store_id` — the constraint does not stop it.

## What the caller workflow requires

`VAPowerDialer.fetchNextLead` reads the queue row, then resolves `store_master` by `store_id`. Every downstream step keys on that same id:

| Step | Depends on |
|---|---|
| Full account tab (`GasMaskStoreWorkPanel`, `StoreAccountWorkspace`) | `storeId` — rendered only when `currentLead.store_id` is truthy |
| Numbers-worked completion gate | store contacts under `store_id` |
| Phone verification (verifier + timestamp) | `store_contacts` / `store_master` rows |
| DO_NOT_CALL disposition | `update store_master where id = store_id` |
| Wrap-up / settle + account attribution | `store_id` on `va_call_logs` and the queue row |

**A DC lead with no `store_id` cannot be worked correctly today.** It dials (queue row carries `phone_number`), but the Full account tab does not render, the numbers gate has nothing to count, verification has nowhere to write, and DNC/disposition writes silently target nothing. Accounts-completed would count an account that has no account record.

## Existing mapping / normalization logic that can be reused

- `promote_lead(p_lead_id, p_by)` — the closest real precedent: refuses unverified leads, **matches an existing `store_master` row by `addr_key` before inserting**, never creates a duplicate, writes a `store_notes` row stamped `[PROMOTED FROM LEAD <id>]` with source and date, and records `promoted_store_id` back on the lead. Works on `public.leads` only.
- `request_store_promotion` / `approve_store_promotion` — territory lane, address-driven (`territory_addresses`), owner/admin approval, inserts `store_master`. Wrong shape for phone-first DC leads.
- `find_store_by_normalized_address`, `normalize_store_address`, `addr_key`, `_norm_phone`, `_norm_text`, `normalize_phone_e164`, `match_import_stores` — reusable matching primitives already in the database.
- `store_master.phone_last10` is a generated column — a phone match is a single indexed lookup.

## Dedupe signals available

1. `store_master.phone_last10` = last-10 of the DC lead phone (strongest, already generated both sides).
2. `addr_key` / `find_store_by_normalized_address` when the lead has a street address.
3. Normalized name + city + state as a last resort (same order the Playboxxx ingest uses).
4. Business scope: match within the GasMask/Grabba family `business_id` only — the same company under another vertical is legitimately a different account.

## Provenance gap

`store_master` has **no** `external_source` / `source_lead_id` column (only `sourced_at`, `sourced_by_ambassador_id`, `consent_source`). `dc_unified_leads` is a view whose identity is `(lead_id, source_table)`. So the DC lead id can be preserved today only in a `store_notes` line (the `promote_lead` pattern) or on the queue row via `entity_type='dc_lead'` + `entity_id=lead_id` + `source_reason`. There is **no existing lead→account mapping table** anywhere.

## Option A — queue DC leads with no canonical account

**Not safe.** It dials fine and breaks everything after the ring: no Full account, no numbers gate, no verification target, DNC writes nowhere, completion counter counts phantom accounts. It also drifts the store book (a called business that exists nowhere) and makes Stage 2 rollups un-attributable to an account. Only acceptable use is a throwaway smoke test.

## Option B — normalize/match into the store book first, then queue

Reuses existing logic almost entirely: `phone_last10` match → `find_store_by_normalized_address` → name+city+state, matching only inside the GasMask/Grabba family; on a match, **link, do not insert**; on no match, insert one `store_master` row plus one `store_contacts` row using the `promote_lead` note pattern for provenance. Then hand the resulting `store_id`/`contact_id` to the existing `dialer-call-list-builder` create path, which already writes the campaign and queue. Every downstream step then works unchanged.

## Recommendation (smallest safe shape)

Option B, with one addition that avoids inventing anything:

1. New function `dc-lead-promote-and-queue` (or a `source: 'dc_lead'` mode inside `dialer-call-list-builder`) that takes an explicit, operator-selected set of DC lead ids — never a whole business unit.
2. Match first (phone_last10 → address → name+city+state). Report matched / created / suppressed / skipped-no-phone as separate counts.
3. One small link table `dc_lead_store_links(lead_id, source_table, store_id, matched_by, created_by, created_at)` with a unique key on `(lead_id, source_table)` — this is the honest place for provenance and makes the operation idempotent, instead of overloading `store_notes`.
4. Reuse the builder's existing build-time suppression (`dnc_list` + `opt_out_events`, last-10) and leave the dial-time fail-closed check alone.
5. Skip leads with `compliance_hold`, `phone_invalid`, or no phone — do not create an account for them.
6. Nothing automatic: promotion is an explicit operator action on a chosen list, same as arming the dialer.

No schema change to `store_master`, no change to `VAPowerDialer`, no change to the completion gate, no backfill.
