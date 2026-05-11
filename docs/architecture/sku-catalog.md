# SKU Catalog & Brand Vocabulary

Canonical source: `src/lib/inventory/skuDisplay.ts` (`CANONICAL_TUBE_SKUS`).

## The 9 canonical SKUs

| Order | Display              | Parent brand  | product_id |
|-------|----------------------|---------------|------------|
| 1 | GasMask Tubes        | GasMask       | dd5e14c0-d6c5-403a-a2d7-504181b0f4ea |
| 2 | GasMask Bags         | GasMask       | 170adb8f-ac4e-40f4-a283-38730d30c5de |
| 3 | GasMask Redtops      | GasMask       | e3eea682-831e-4913-8b0e-563bc1325a1f |
| 4 | HotScalati Mix Pack  | HotScalati    | 04336f6d-d69b-4ec8-8571-7088783b31d6 |
| 5 | HotScalati Dark      | HotScalati    | 1c4f112e-97a1-4430-aae0-f1fcc0229a85 |
| 6 | HotScalati Light     | HotScalati    | 27e21aec-21a2-4ce7-9515-dbfd618a27c6 |
| 7 | HotScalati Bros      | HotScalati    | fcfe5469-e9d3-40f3-8bf4-a4349086e1c3 |
| 8 | Hot Mama             | Hot Mama      | 2dfcbd00-0e44-4cd1-b80d-b00a33b123c5 |
| 9 | Grabba R Us          | Grabba R Us   | 2d28e463-5296-4d42-b548-896d18ee906e |

> **Roso (parking lot):** Owner to confirm whether "Roso" is the Mix Pack or a separate SKU. Until confirmed, Mix Pack stays as the display label.

## Brand → SKU mapping

| Parent brand  | SKUs |
|---------------|------|
| GasMask       | Tubes, Bags, Redtops |
| HotScalati    | Mix Pack, Dark, Light, Bros |
| Hot Mama      | Hot Mama |
| Grabba R Us   | Grabba R Us |

`store_tube_inventory.brand` raw values (`gasmask`, `gasmasktubes`, `hotscolatti`, `hotscalati`, `hotmama`, `grabba`) collapse to a parent via `inventory_keys` on each canonical SKU. Display normalization goes through `brandDisplayName()`.

## Lifecycle status (per SKU, per store)

Computed in `useStoreLifetimeByBrand` and `useStoreSoldByBrandWindow`:

- **`bought`** 🟢 — invoice line items > 0 in window
- **`staged`** 🟡 — inventory present (`inventory_keys` matched in `store_tube_inventory`) but no sales
- **`never_offered`** 🔴 — no inventory and no sales

Action labels (`getSkuStatusLabel`): `sold`, `stocked: N`, `pitch`.

## Information layers

- **Hero chips (Lifetime, Prior Month, Last 30d)** → SKU-level. Always render all 9 canonical SKUs so drivers see what to pitch.
- **Stock chip** → parent brand-level (current inventory schema does not yet carry `product_id`; Session 8 upgrade).
- **Footer "Lifetime Sold by Brand" bar** → brand-level. At-a-glance summary; chip expansions provide SKU detail one click away. Different granularities serve different decisions.

## Vocabulary normalization rules

1. SKU labels render via `skuDisplayName(productId, fallback)`.
2. Brand labels render via `brandDisplayName(raw)`. Never display raw `gasmasktubes` / `hotscolatti` strings.
3. Cache keys for SKU rollups use the `-by-sku` suffix; brand-level keys keep `-by-brand`. Both are invalidated together in `invalidateStoreInventoryQueries`.
4. New surfaces that show tube data MUST consume these helpers — do not re-introduce ad-hoc capitalization or string manipulation.
