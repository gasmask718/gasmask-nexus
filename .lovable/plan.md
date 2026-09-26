# Read-only audit: Anna / Super City supplier setup, import and variants

Nothing was created, imported, changed or published. Approving this runs nothing.

## 1. Supplier account
- **No supplier exists** for Anna, Super City, Super City NY or SUPER C&C TRADING INC.
- Checked `suppliers` (0 rows), `wholesalers` (no match) and `wholesaler_profiles` (9 rows, all test/Paul/Dynasty Direct entries).
- The only "Anna" in `profiles` is `gasmaskcompany3@gmail.com` with the **driver** role. That is not a supplier.

## 2. Creating a supplier
**Working path: an email invite.**
- **Where:** `/dynasty-direct/invites` (`DynastyDirectInvites.tsx`, `InviteButton`, the `send-invite` function). This adds a row to `invites`.
- **Next step:** the supplier opens `/invite/:token` (`UniversalInviteAccept.tsx`) and signs up. RPC `accept_invite` then creates their `wholesaler_profiles` row with status **verified**.
- **Login:** the supplier creates it when they accept. It is not made automatically.
- **Approval:** there is no approval step when the account is created. `wholesaler_profiles.status` can be `pending` or `verified`.

**Unused path: the `dd-provision-wholesaler` function.**
- Admin only.
- **Required:** email, company_name.
- **Optional:** password (generated if left out), contact_name, phone, wholesaler_type, notes.
- It creates the login right away, email already confirmed, plus the wholesaler role and a verified profile.
- No button or page calls it.

## 3. Supplier spreadsheet import
- **Where:** `/portal/wholesaler/catalog/onboard?mode=spreadsheet` (`WholesalerCatalogOnboard.tsx` line 136 renders `BulkUploadModule.tsx`).
- **Columns:** product_name, description, category, subcategory, sku, supplier_cost, inventory_qty, weight_oz, length_in, width_in, height_in, image_url. Also accepted: `price`, `images`, `image`.
- **File types:** CSV and XLSX/XLS both work (`xlsx` library, lines 165-176).
- **Images:** image URLs work, and several can go in one cell separated by `;` (line 126).
- **Flow:**
  1. Upload the file.
  2. `ai-categorize-products` fills in categories, in batches of 10. If that fails, local rules are used.
  3. The supplier reviews and edits the rows on screen.
  4. `publishItems()` saves the rows to `dd_catalog_drafts` as `pending_admin_review`, source `bulk_upload`.
  5. An admin opens `/dynasty-direct/catalog/review` (`DynastyDirectCatalogReview.tsx`).
  6. `approve()` sends the product live through `dd-catalog-pipeline`, which adds it to `products_all`.

## 4. Test-import safety
- **Preview:** yes. The supplier reviews on screen first, and then every product waits in the admin queue.
- **Reject:** yes. `reject()` sets the status to `rejected` and records a reason. There is no delete button, so a rejected draft stays in the table.
- **Database check:** trigger `dd_enforce_self_serve_review` pushes any non-admin publish back to review. The self-serve setting (`dd_config.wholesaler_self_serve_enabled`) is **off** right now.
- **Blocker:** with self-serve off, the onboard page shows **"Coming Soon" to suppliers**. A supplier cannot use the spreadsheet import today unless that setting is turned on.
- **Pending suppliers:** no check looks at `wholesaler_profiles.status`. A pending supplier could upload whenever self-serve is on, and the drafts would still wait for review.
- **Linking to the supplier:** each draft is linked automatically through `dd_catalog_drafts.supplier_id` (the supplier's profile id), plus `created_by` and `submitted_by`.
- **Admin uploading for a supplier:** no admin page offers this.

## 5. Variants
- **`product_variants`:** columns for sku, variant_name, attributes (jsonb), prices, stock, is_default and so on. It has **0 rows and no code uses it**.
- **`products_all`:** has plain fields `has_variants`, `variant_types`, `flavor_or_variant` and `size_or_count`. No parent or family column groups variants together.
- **Result:** each color, size or flavor has to be its own product row.

## Limits
- I could not search the login-account list directly, so the search covered supplier, wholesaler and profile tables only.
- I did not review every access rule on the drafts table.

## SAFE NEXT ACTION
Give me Anna's company name and email so I can create **one email-bound supplier invite from `/dynasty-direct/invites`**, and nothing else. Two decisions follow before any import:
1. Turn the supplier self-serve setting on so she can upload, or keep it off and choose another route.
2. Test with a small 3-5 row sheet first. Each variant is its own row, and each product needs a review in the admin queue before it goes live.
