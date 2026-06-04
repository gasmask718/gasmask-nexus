# Dual Catalog Architecture

**Status:** Canonical. Enforced by Grabba Bridge. CI grep rule below.

The OS runs **two parallel product catalogs** that must never bleed into each other except through one sanctioned crossover.

## The two catalogs

### `products` — Grabba / production-owned
- **Owner:** internal manufacturing + Grabba operations
- **Source of truth for:** production batches, inventory_stock, bag pipeline, store-route fulfillment, COGS ledger
- **Pricing:** computed (wholesale_price, retail_price) — no manual overrides
- **Identity:** SKU-first, brand prefix isolation (`tt_`, `ut_`, `funding_` rules from Table Isolation memory)
- **Surfaces:** Grabba Hub, Production, Inventory, Wholesaler Portal, Bikers/Drivers field portals

### `products_all` — Dynasty Direct / consumer-owned
- **Owner:** marketplace + D2C catalog
- **Source of truth for:** DD storefront, consumer carts, marketplace_orders, customer invoices
- **Pricing:** computed via `pricing_tiers` (retail/store/wholesale) — same no-override rule
- **Identity:** consumer-facing (titles, descriptions, images, categories)
- **Surfaces:** Dynasty Direct site, customer portal, ambassador catalog, marketplace fulfillments

## The only legal crossover: Grabba Bridge

When a `products` SKU must appear on the consumer storefront, it crosses through the **Grabba Bridge** — a deliberate, audited mirror layer that:

1. Projects the production SKU into a `products_all` row with the marketplace shape
2. Keeps inventory/COGS reads on the `products` side
3. Marks the bridged row so reverse joins are explicit

**No other path is allowed.** Direct joins from `products_all` back to `products` (or vice versa) outside the bridge are an architecture violation.

## CI grep rule

Any join across the two catalogs outside of the bridge must fail review. Block patterns:

```bash
# A products_all query that joins/filters by a products column
rg "from\(['\"]products_all['\"]\)[\s\S]*products\.(sku|production_batch_id|brand_prefix)" src/

# A products query that joins/filters by a products_all column
rg "from\(['\"]products['\"]\)[\s\S]*products_all\.(slug|storefront_id|public_image_url)" src/
```

Allowed only inside `src/lib/grabbaBridge/*` and its edge function counterparts.

## Why parallel by design

- Production reality (batch IDs, raw materials, sticker counts, immutable approved batches) is meaningless to a consumer.
- Marketplace reality (variants, SEO copy, lifestyle imagery, multi-source carts) is meaningless to the line.
- Merging them would either force consumer pollution into production tables (breaking the manufacturing memory standard) or strip production rigor from the storefront (breaking the marketplace standard).

Two catalogs, one bridge. That's the contract.
