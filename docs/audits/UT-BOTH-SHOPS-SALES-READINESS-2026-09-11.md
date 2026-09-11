# UT BOTH SHOPS — SALES READINESS AUDIT (STOPPED AT PART 1)

Date: 2026-09-11
Mode: READ-ONLY. No code, schema, checkout, product, supplier or order changes were made.
Backend: Lovable Cloud project `qalaaroashbggynpvqct`.
Stop reason: Part 1 gate — the two shop paths described by the owner cannot be identified
in this project, and two of the systems the prompt says to reuse do not exist here.

---

## 1. EVERY CUSTOMER-FACING PURCHASE PATH FOUND

### Path A — `/store` (Shopify: unforgettable-times-usa.myshopify.com)
| Aspect | Finding |
| --- | --- |
| Route/page | `/store` → `src/pages/ShopifyStore.tsx` (`AppRoutes.tsx:1432`) |
| Product source | Shopify Storefront GraphQL API via `src/hooks/useShopifyProducts.ts` (hardcoded public storefront token) |
| Cart | NONE in this app. "Buy Now" opens `https://unforgettable-times-usa.myshopify.com/products/<handle>` in a new tab |
| Checkout provider | Shopify, entirely off-platform |
| Payment provider | Shopify Payments / whatever the Shopify store is configured with — not visible to this project |
| Order storage | Shopify only. `UTShopDashboard.tsx` shows hardcoded zeros and the text "connect Shopify API" |
| Shipping calculation | Shopify's own rules. This project has no input |
| Live/tested | The product grid is live and reads the Storefront API. No order data, no webhook, no Shopify Admin credential exists (secret list contains no `SHOPIFY_*` entry) |

This is a **product catalogue window into an external store**, not a checkout we control.

### Path B — UT Stripe order/checkout (`ut-create-checkout`)
| Aspect | Finding |
| --- | --- |
| Route/page | No customer-facing route. Reached only from internal ops UI (`UTEventBuilder`, `useUTCustomerEngine.initiateCheckout`) under `/os/unforgettable/*` |
| Product source | `ut_products` — **0 rows** |
| Cart | None. Charges a single `ut_orders` row (event package), not a product cart |
| Checkout provider | Stripe Checkout Session (`supabase/functions/ut-create-checkout`) |
| Payment provider | Stripe (`STRIPE_SECRET_KEY`), verified by `ut-verify-payment` / `ut-stripe-webhook` |
| Order storage | `ut_orders` — **0 rows**; `ut_customers`, `ut_suppliers` also empty |
| Shipping calculation | None. Charges `total_price` as one line item |
| Live/tested | Code path exists; no orders have ever been created |

### Path C — `/shop`, `/cart`, `/checkout` (Dynasty Direct)
Real, working D2C storefront (`products_public` → `dd-create-checkout` → Stripe, `dd-shipping-quote`
live carrier rates). **This is Dynasty Direct, a different brand — not UT.** Recorded only so it is
not mistaken for a UT shop.

---

## 2. WHY THIS STOPS AT PART 1

1. **There are not two comparable UT shop paths.** There is one external Shopify catalogue we do
   not control, and one internal Stripe event-order function with zero products and zero orders.
   Assuming Ching means "Shopify + Dynasty Direct's /shop" would put UT supplier-quote logic into
   another brand's live storefront. That is a guess, and the prompt forbids guessing.

2. **The "Phase 1 shipping system" referenced in Part 2 does not exist in this project.**
   - No `get_checkout_shipping_rate` function, and no function whose name contains
     `shipping`/`quote` other than Dynasty Direct's `dd_*` and unrelated vertical helpers.
   - `ut_shipping_rates` holds **3 generic carrier rows** (USPS/UPS/FedEx base fee + per-kg,
     created 2026-06-25). No product reference, no destination state, no supplier confirmation,
     no revoke/supersede columns.
   - `ut_shipping_quotes` — **0 rows**; `ut_supplier_quotes` exists but is not wired to checkout.
   There is no centralized supplier-confirmed eligibility rule here to reuse.

3. **The "4,064-product master" is not in this backend.** Largest product-ish tables:
   `products_all` 34, `products` 12, `ut_products` 0. Nothing near 4,064.

4. **Shopify cannot support supplier-confirm-before-charge as currently integrated.** Only a public
   Storefront token is present (hardcoded in `useShopifyProducts.ts`). There is no Shopify Admin
   API key, no app credential, and no order webhook, so this project cannot create draft orders,
   hold payment, adjust shipping after the fact, or even see that an order happened.

---

## 3. WHAT WOULD UNBLOCK THIS

Owner decisions needed (one line each is enough):

- **A. Which two shops?** Name the two URLs Ching means. Likely candidates:
  (i) the Shopify store `unforgettable-times-usa.myshopify.com`, and (ii) a UT storefront that
  does not yet exist in this project — or (ii') the Dynasty Direct `/shop`, if he considers it a
  UT-served surface.
- **B. Where is the Phase 1 shipping system?** If it was built, it is in a different project or
  environment. If it was specified but never built, say so and it will be built here first.
- **C. Where is the 4,064-product master?** Same question — different project, a spreadsheet, or
  Shopify itself.
- **D. Shopify access.** Supplier-confirm-before-charge on Shopify requires a Shopify Admin API
  credential (draft orders / payment holds). Without it, Shopify can only sell items that already
  have a confirmed rate.

Nothing in Parts 2–11 can be implemented safely until A and B are answered.

---

## OUTPUT SUMMARY

1. **Exact two shop paths identified** — NOT IDENTIFIED. One external Shopify catalogue, one
   empty internal Stripe order path, one non-UT brand storefront.
2. **Payment mechanism for each** — Shopify: off-platform, no control. UT Stripe: Checkout Session,
   supports SetupIntent/manual-capture in principle but has no storefront or products.
3. **Confirmed-rate path status** — NOT BUILT (no supplier-confirmed rate model exists).
4. **Quote-required path status** — NOT BUILT.
5. **One-off supplier form status** — NOT BUILT.
6. **Payment-after-confirmation status** — NOT BUILT.
7. **Quote → reusable rate feedback status** — NOT BUILT.
8. **Admin quote queue status** — NOT BUILT.
9. **Test results for both shop paths** — NOT RUN (no valid second path; no test charge attempted).
10. **True remaining blockers** — owner decisions A–D above.

### CAN UT ACCEPT A SALE SAFELY TODAY?

- **Shopify store (`/store` → myshopify.com): PARTIAL.** Shopify itself can take money today under
  its own shipping rules. This project cannot see, gate, or shipping-quote those orders at all.
- **UT Stripe path: NO.** No customer-facing storefront, no products, no orders, no shipping logic.

### Smallest remaining step before a first real sale

Confirm with Ching which two shops he means and where the Phase 1 shipping rate system and the
4,064-product master live. If the intended UT shop does not exist in this project, the smallest
safe first sale is: sell on Shopify only the items whose real shipping cost is already known, and
build the quote-gated flow on the UT Stripe path once the product source is pointed at.
