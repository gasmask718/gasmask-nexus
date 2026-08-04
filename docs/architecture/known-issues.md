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

---

## ENUM-001: `brand_type` Enum Value "HotScalati" Misspelled

**Severity:** Cosmetic (zero user impact)
**Logged:** 2026-05-29
**Status:** Deliberate — DO NOT FIX without coordinated migration

### Symptom
The Postgres `brand_type` enum contains the literal `"HotScalati"` (misspelled). All user-visible UI correctly displays `"Hotscolatti"` via the canonical brand registry (`src/config/brands.ts`).

### Why we're not fixing it
- The enum is an internal lookup key — never rendered to users.
- Renaming requires a synchronized DB migration + code change across ~14 files that match the literal `"HotScalati"`.
- Any drift between migration timing and deploy carries silent-broken-lookup risk (brand joins fail, dashboards go empty).
- Reward = zero (no one sees it). Risk = nonzero.

### Rule for future agents
Code spots matching the literal string `"HotScalati"` (enum comparisons, switch cases, brand_type filters) are **CORRECT as-is** and must continue to match the DB enum. Do NOT "fix the spelling" in these locations:

- `src/services/dynastyAI.ts`
- `src/hooks/useVAPermissions.ts`
- `src/components/templates/TemplateEditor.tsx`, `TemplateList.tsx`
- `src/pages/grabba/AIInsights.tsx`, `GrabbaClusterDashboard.tsx`, `UnifiedUploadCenter.tsx`
- `src/components/store/StoreTubeIntelCard.tsx`, `StoreTubeInventoryCard.tsx`
- `src/components/contacts/AdvancedContactModal.tsx`, `AddContactModal.tsx`
- `src/components/delivery/checklist/StickerVisibilitySection.tsx`
- `src/config/grabbaSkyscraper.ts` (mapping value)

### When to revisit
Only if a future refactor of `brand_type` (replacing the enum, restructuring brand joins, or a full brand-table rewrite) is already in scope. At that point, fold the rename in as part of the larger migration.

---

## SBO — capper pick parser: anytime-home-run picks carry YES/NO direction (LOGGED, NOT FIXED)

**Logged:** 2026-08-04 · **Status:** open, out of scope for the prop-grader task · **Owner:** SBO ingestion

### Symptom
`sbo-grade-capper-props` dry run skipped a handful of `home_runs` picks. Cause: 71 of 89 `home_runs` rows in `sbo_capper_picks` have `direction = 'YES'` (18 have `OVER`). `YES` is the anytime-home-run market, which is a boolean outcome, not an over/under line. The grader's `gradeOverUnder()` only understands OVER/UNDER, so those rows fall through as skips.

### Why it is not fixed here
This is an upstream parser/vocabulary gap in `sbo-parse-capper-image` / `sbo-telegram-intake`, not a grader bug. Papering over it inside the grader would hide the same vocabulary problem everywhere else it shows up (matching, signal fanout, capper win-rate math).

### Correct fix, when scheduled
Normalize the anytime-HR market to its own canonical prop (e.g. `home_runs_anytime`, boolean outcome, `line` implicitly 0.5) at parse time, and give the grader a boolean branch for it. Leave `home_runs` OVER/UNDER as the true line market.

### Rule for future agents
Do NOT convert `direction = 'YES'` to `OVER` with an implied 0.5 line inside the grader. Fix it at the parser.
