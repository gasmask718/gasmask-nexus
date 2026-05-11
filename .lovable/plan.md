
# SKU-Aware Inventory — Phased Ship Plan

## Why phased, not one shot

`store_tube_inventory` is referenced in **38 files** including 5 edge functions, the unified Tube Intelligence card (947 lines), Grabba CRM/Penthouse, exports, and SLA alerts. The unique constraint is `(store_id, product_id, is_simulation)` — flipping writers to `product_id` while readers still group by `brand` will produce duplicate rows and broken aggregates if shipped together. We ship in **4 PRs**, each independently verifiable.

---

## PR 1 — Writers persist product_id (foundation, no UI change yet)

Files:
- `src/components/store/UnifiedTubeIntelligenceCard.tsx` (saveMutation)
- `src/components/store/EditableTubeInventoryCard.tsx` (saveMutation)
- `src/components/store/UpdateInventoryModal.tsx`
- `src/services/fieldGovernance/governedMutations.ts`
- `src/components/delivery/checklist/InventoryCheckSection.tsx`

Change every insert/update to:
1. Resolve `product_id` from a single helper `resolveProductIdForBrand(brandId)` backed by `CANONICAL_TUBE_SKUS` (default SKU per parent brand: GasMask→Tubes, HotScalati→Mix Pack).
2. Upsert by `(store_id, product_id, is_simulation)` instead of `(store_id, brand)`.
3. Keep writing `brand` for backward compatibility with existing reads.

Verification: insert 1 test row from each writer surface; confirm new row has populated `product_id` and the unique constraint isn't violated.

---

## PR 2 — Tube Intelligence becomes 9 SKU lanes (operator-facing)

Files:
- `src/components/store/UnifiedTubeIntelligenceCard.tsx`

Change:
- Replace `VALID_TUBE_BRANDS` iteration with `CANONICAL_TUBE_SKUS` (9 lanes).
- `editedCounts` keyed by `product_id` (not brand).
- Save mutation upserts per product_id row.
- Render: GasMask group (Tubes/Bags/Redtops), HotScalati group (Mix/Dark/Light/Bros), Hot Mama, Grabba R Us.
- Lifetime/last-order data joined via `product_id` where available, fall back to brand.
- Active-toggle mapping table updated for the 3 new SKUs.

EditableTubeInventoryCard + UpdateInventoryModal updated to match (or deprecated if redundant).

---

## PR 3 — Readers and chips show 9 SKUs

Files:
- `src/hooks/useStoreInventoryByBrand.ts` → add `useStoreInventoryBySku.ts` (per product_id rollup, always emits all 9 canonical SKUs with status icons).
- `src/hooks/useStoreLifetimeByBrand.ts` and `useStoreSoldByBrandWindow.ts` → ensure SKU variants exist (per-product_id) consumed by Lifetime / Prior Month / Last 30d chips.
- `src/components/store/StoreTubeInventoryCard.tsx` and `StoreTubeIntelCard.tsx` → render 9 SKU rows from canonical list, status icon (🟢🟡🔴) per `getSkuStatusLabel`.
- `src/components/company/BrandBreakdownCards.tsx` and `src/components/store/ConnectedStoresCard.tsx` → keep brand-level totals as-is (footer bar stays brand-level per `docs/architecture/sku-catalog.md`).

---

## PR 4 — Bland AI + edge-function ingestion routed to default SKUs

Files:
- `supabase/functions/autopilot-daily/index.ts`
- `supabase/functions/calculate-health-scores/index.ts`
- `supabase/functions/ceo-dashboard-metrics/index.ts`
- `supabase/functions/intelligence-report/index.ts`
- `supabase/functions/gdrive-backup/index.ts` (read-only, audit only)
- Bland AI inventory parser (locate via `useBulkUpload.ts` + `aiTasks.ts`)

Change:
- Inline a `BRAND_TO_DEFAULT_PRODUCT_ID` map (mirror `CANONICAL_TUBE_SKUS`).
- When parser only emits a brand string, write to that brand's default SKU `product_id` and set `needs_operator_verification = true` so Tube Intelligence flags it (already wired in PR 2).
- Read functions (`calculate-health-scores`, `ceo-dashboard-metrics`) join through `product_id` for accurate per-SKU rollups; keep brand-level totals working.

---

## What ships per PR

| PR | Operator sees | Risk if isolated | Effort |
|----|---------------|------------------|--------|
| 1  | Nothing (foundation) | Low — writes get `product_id`, reads unchanged | ~25 min |
| 2  | 9 editable SKU lanes in Tube Intelligence | Medium — single component swap | ~30 min |
| 3  | Stock + Lifetime/Window chips show all 9 SKUs with status icons | Low — additive hook + render swap | ~25 min |
| 4  | Bland AI calls capture per-SKU truth (default SKU + verify flag) | Low — edge functions only | ~20 min |

**Total ~100 min, but each PR is independently shippable and verifiable.**

---

## What I need from you

Approve this plan and I ship **PR 1 immediately**, then proceed sequentially through PRs 2 → 3 → 4 in this same loop, pausing only if a step fails verification. If you want a different order (e.g., PR 2 first because Tube Intelligence is more visible), say so and I'll re-sequence.
