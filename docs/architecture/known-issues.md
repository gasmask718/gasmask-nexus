# Known Issues

## TRG-001: Store Type Downgraded by Sync Triggers

**Severity:** Medium (data quality)
**Discovered:** 2026-05-11 during Session 8 Halt 4
**Status:** Deferred — workaround active

### Symptom

Every `stores` INSERT with a specific `type` (bodega, smoke_shop, gas_station,
wholesaler) is silently downgraded to `'other'` after the sync trigger pair runs.
The original value is correctly written at INSERT time, then overwritten by the
return-sync UPDATE.

### Root Cause

```
stores INSERT (type=smoke_shop)
  → AFTER sync_store_to_store_master:
      INSERT INTO store_master (store_type = NULL)   -- type not forwarded
  → AFTER sync_store_master_to_stores:
      UPDATE stores SET type = mapped_type
      mapped_type := CASE LOWER(NEW.store_type) ... ELSE 'other'
      NEW.store_type IS NULL  →  coerces to 'other'
```

The forward trigger (`sync_store_to_store_master`) does not project `type` into
`store_master.store_type`. The reverse trigger then maps NULL → `'other'` and
writes it back to `stores`, clobbering the caller's value.

### Affected Paths

All `stores` insert paths app-wide, not just the new capture flow. The bug has
existed for months and is the reason the vast majority of historical rows show
`type='other'`.

### Workaround (Active)

- New captures still write the intended `type` at insert time (audit-visible in
  trigger logs even though the row is overwritten).
- The Phase 6 approval queue is the operator correction point: reviewer sets the
  correct `type` during approval, which writes via UPDATE (not INSERT) and is
  not subject to the same downgrade path.
- Until TRG-001 is fixed, treat `stores.type` as operator-curated, not
  capture-sourced.

### Fix (Deferred)

One-line patch to `sync_store_to_store_master`: forward `NEW.type` into
`store_master.store_type` on INSERT. Must be tested against every code path
that writes to `store_master` directly to ensure the reverse mapping still
behaves. Slated for a dedicated session — too broad to patch mid-feature.

### Do Not

- Do not bypass the sync triggers from feature code. The triggers exist for
  cross-table parity; silencing them in one path causes drift.
- Do not "fix" by defaulting `type` in the form. The form already passes the
  user's selection correctly; the loss happens server-side.

## TRG-001 → see also docs/architecture/store-capture-system.md
