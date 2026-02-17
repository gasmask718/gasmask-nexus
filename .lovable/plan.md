
# Plan: Connect Marketplace Checkout to Dispatch and Invoice Systems

## The Problem
Right now, three critical systems are completely disconnected:

1. **Marketplace Checkout** writes to `marketplace_orders` (user-facing)
2. **Dispatch/Assignments** reads from `store_orders` (operations-facing)
3. **Invoices** are never auto-created from orders

When a user places an order at checkout, it never appears in `/grabba/assignments` because that page only queries `store_orders`. No invoice is generated either.

## The Solution

Bridge the checkout flow so that placing an order automatically:
1. Creates a `store_orders` record (so it appears in Assignments)
2. Creates an `invoices` record with line items (financial truth)
3. Links `delivery_tasks` properly so the Live Map shows trajectories

The full flow becomes:
**User places order** --> auto-creates `store_orders` + `invoices` --> **Admin assigns biker/driver** at `/grabba/assignments` --> **Biker gets notified** (accept/decline) --> **Biker delivers and updates status** --> **Live Map shows trajectory**

---

## Technical Details

### Step 1: Database -- Add `marketplace_order_id` column to `store_orders`
Add a nullable `marketplace_order_id` UUID column to `store_orders` to link back to the marketplace order. This preserves the relationship between user-facing and ops-facing records.

### Step 2: Modify `useCheckout.ts` -- Auto-create `store_orders` + `invoices` after checkout

After the existing `marketplace_orders` insert, add two more inserts:

**A) Create a `store_orders` record:**
- Map the user's store (lookup `store_master` by user profile or shipping address)
- Copy `order_number`, `total`, `delivery_address`, `recipient_name`, `recipient_phone` from checkout data
- Set `status: 'pending'`, `payment_status` from checkout selection
- Store `delivery_lat`/`delivery_lng` via geocoding or null

**B) Create an `invoices` record with `invoice_line_items`:**
- Generate a sequential `invoice_number` (e.g., `INV-{timestamp}`)
- Set `store_id` from the resolved store, `order_id` from the new `store_orders` record
- Set `entity_type: 'store'`, `entity_id` from the store
- Set `due_date` to 30 days from now (Net 30 standard)
- Set `status: 'draft'`, `payment_status: 'unpaid'`
- Create one `invoice_line_items` row per cart item with product name, quantity, unit price, and pricing snapshots

### Step 3: Update `StoreOrders.tsx` (portal/store) -- Show both marketplace and store orders

Currently `/portal/store/orders` only shows `marketplace_orders`. Update it to also show the linked `store_orders` data (fulfillment status, delivery tracking) so the store user sees a unified view of their order lifecycle.

### Step 4: Verify `/grabba/assignments` works automatically

The Assignments page already reads from `store_orders` -- once Step 2 creates records there, orders will automatically appear. No changes needed to the Assignments page itself.

### Step 5: Verify Live Map works automatically

The Live Map already reads `delivery_tasks` linked to `store_orders`. Once an admin assigns a biker/driver via Assignments (which creates a `delivery_task`), the trajectory will render on the map using the existing logic (including the store-pickup fallback from the previous fix).

### Step 6: Invalidate correct query keys

After checkout, invalidate:
- `['assignment-orders']` -- so Assignments page refreshes
- `['store-invoices']` -- so invoice list refreshes
- `['store-orders']` -- so portal orders refresh

### Files Changed

1. **Database migration** -- Add `marketplace_order_id` to `store_orders`
2. **`src/services/marketplace/useCheckout.ts`** -- Add auto-creation of `store_orders` + `invoices` + `invoice_line_items` after marketplace order insert
3. **`src/services/store/useStoreOrders.ts`** -- Minor update to also surface fulfillment data from linked `store_orders`
4. **`src/pages/portal/store/StoreOrders.tsx`** -- Show delivery status from the linked `store_orders`/`delivery_tasks`
