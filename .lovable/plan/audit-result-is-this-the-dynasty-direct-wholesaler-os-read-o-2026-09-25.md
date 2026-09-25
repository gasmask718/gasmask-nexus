# Audit Result: Is this the Dynasty Direct wholesaler OS? (read-only, no changes)

Nothing was changed. No code change is proposed. Approving this just confirms the findings.

## VERDICT: B, confirmed. This is the Dynasty OS / GasMask command center. It contains the Dynasty Direct admin hub and the wholesaler (supplier) portal, both running on the same backend.

This app is not only Dynasty Direct. It also runs GasMask, the ambassadors, the dialer, Unforgettable Times, TopTier, Funding and more. The public shopping site (dynasty-connect-market.lovable.app) is a **separate Lovable project** with its own backend, as found in the earlier auth-redirect audit.

## Evidence
- **Name:** the page title is "Dynasty OS — GasMask Command Center". The package name is still the template default.
- **Backend:** Lovable Cloud project `qalaaroashbggynpvqct`.
- **Mentions:** "Dynasty Direct" appears in 157 files, including routes, services and migrations. `useDynastyDirectProducts` describes itself as "Dynasty Direct products available for stores to order".
- **Admin routes:** about 30 under `/dynasty-direct/*`, including catalog, catalog/onboard, catalog/review, products, inventory, inventory/forecast, pricing, orders, fulfillment, purchase-orders, returns, partners, invites, flash-sales, d2c-storefront, commission-rates and settings.
- **Supplier portal:** `/portal/wholesaler/*` (Overview, Products, Orders, Fulfillment, Inventory, Earnings, Transactions, Messages, Team, Settings, Quick Add by Photo), inside `DDPortalShell`.
- **Backend functions:** 63 functions start with `dd-`. Examples: dd-catalog-pipeline, dd-identify-product-photo, dd-process-image, dd-auto-price, dd-price-intelligence, dd-provision-wholesaler, dd-create-checkout, dd-create-shipment, dd-generate-po, dd-notify-supplier-order, dd-refund-order, dd-pay-partner, dd-generate-partner-payouts, dd-grabba-bridge.

## Where product and catalog data lives
- **Products:** `products_all` (45 rows) is the wholesaler marketplace catalog. The shop reads it through the public view `products_public`, filtered to status = active. `products` (12 rows) holds the internal/GasMask products. `dd_catalog_drafts` holds photo captures before they are finalized.
- **Prices:** columns on `products_all`: retail_price, store_price, wholesale_price and street_price. Also dd-auto-price and `dd_config`.
- **Inventory:** `products_all.inventory_qty`, plus `dd_store_inventory` and `dd_purchase_orders`.
- **Suppliers:** `wholesaler_profiles` (9 rows), `wholesalers`, `wholesaler_assignments`, `wholesaler_orders`, `wholesaler_payouts`, `dd_partner_wholesaler_links`.
- **Variants:** I found no separate variants table. Unit type, weight and dimensions are stored on each product row.
- **Images:** the `products_all.images` array. Storage buckets: `product-images`, `dd-products-raw`, `dd-products-processed`, `dd-capture-backup`, `storefront-captures`, `dd-return-photos`.
- **Money and other:** `dd_split_ledger`, `dd_reserve_ledger`, `dd_credit_accounts`, `dd_subscriptions`, `dd_pro_subscriptions`, `dd_affiliates`, `dd_flash_sales`, `dd_bundles`, `dd_support_tickets`.

## Anna / Super City / SUPER C&C TRADING INC
- **Code:** no mention of "Super City" or "SUPER C&C". The 21 files matching "Anna" are unrelated: US state names, dialer/lead code, and a scout agent.
- **Database:** no wholesaler profile or wholesaler record has a name matching "super" or "anna". If Anna's company is set up, it is under a different company name or linked by user only. That is not confirmed.

## Limits
- I did not open every one of the 63 dd- functions or all 2,000+ tables.
- I did not inspect the separate Dynasty Direct shopping-site project.
