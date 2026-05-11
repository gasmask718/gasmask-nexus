# Driver-First Visibility Pattern

A UI standard for any operator-facing surface where a field driver, biker, or rep must decide *what to pitch next*.

## Principle

> **Show all canonical items, always — even zeros. A hidden zero is a missed pitch.**

When a store has never sold HotScalati Bros, the driver needs to *see* that gap. Filtering out zero-value rows optimizes for visual cleanliness at the cost of operational value. We optimize for the driver.

## Status icons

| Icon | Status          | Meaning                                            | Action label        |
|------|-----------------|----------------------------------------------------|---------------------|
| 🟢   | `bought`        | Sales > 0 in window                                | `sold`              |
| 🟡   | `staged`        | Inventory present, no sales                        | `stocked: N`        |
| 🔴   | `never_offered` | No inventory, no sales — virgin pitch opportunity  | `pitch`             |

Defined in `src/lib/inventory/skuDisplay.ts` (`getSkuStatusIcon`, `getSkuStatusLabel`).

## Pattern checklist

When building a driver-facing breakdown:

1. Source the **canonical catalog** (e.g. `CANONICAL_TUBE_SKUS`) — never derive the row set from the store's own data.
2. Left-join store data (sales, inventory) against the catalog so missing rows still render.
3. Compute a `status` per row from the join result.
4. Render an icon + label even when the value is zero.
5. Order rows by the catalog's canonical `order` field, not by value descending — drivers learn the menu position.
6. Reconcile chip totals as the **sum of displayed rows**, not from a separate summary view (prevents math drift).

## Reference implementation

- `useStoreLifetimeByBrand` / `useStoreSoldByBrandWindow` — return all 9 SKUs with `status`.
- `TubesSoldHeroStrip` — chip expansions render the icon + action label.

## Future surfaces that should adopt this pattern

- Per-store reorder suggestions (show un-stocked SKUs as `pitch`).
- Route stop summaries (show what each store has *not* yet bought).
- Wholesaler portal store-detail views.
- TopTier / UFT vendor catalogs where reps can up-sell add-ons.

## When NOT to use this pattern

- High-level summary bars (e.g. footer brand bar) where information density matters more than pitch readiness.
- Public/customer-facing surfaces (zeros are noise to the buyer, signal to the seller).
