

# Make Customer Portal (`/portal/customer`) Fully Functional

## Overview
Replace all mock/hardcoded data on the Customer Portal with live database queries, and wire up navigation to the existing `/shop` page for browsing and ordering products. The page will show the real logged-in customer's profile, their actual order history from `marketplace_orders`, and functional navigation to shop, cart, and order tracking.

## What Changes

### 1. Real Profile Data
- The page already fetches `useCurrentUserProfile()` -- we will also pull the user's `profiles` record (name, email, phone) to display complete account info.

### 2. Real Order History (replace mock data)
- Query `marketplace_orders` filtered by `user_id = auth.uid()` with joined `marketplace_order_items` and product details.
- Display actual order ID (truncated), date, item count, total, and fulfillment/payment status.
- Map `fulfillment_status` values (`pending`, `processing`, `shipped`, `delivered`) to the existing `HudStatusBadge` component.

### 3. Real Quick Stats
- **Total Orders**: COUNT from `marketplace_orders` for this user.
- **Saved Addresses**: Count unique shipping addresses from past orders (extracted from `shipping_address` JSONB).
- **Rewards Points / Available Deals**: Keep as placeholder (no rewards table exists yet) but clearly label as "Coming Soon".

### 4. Active Delivery Banner
- Query `marketplace_orders` where `fulfillment_status = 'shipped'` (in transit) for the current user.
- Show the real order ID and estimated delivery info if an active delivery exists.

### 5. Functional Navigation Cards
- **Shop Now**: Already navigates to `/shop` -- keep as-is (correct).
- **My Orders**: Navigate to a new section or scroll-to the orders list on the same page; show the full order list with details.
- **Addresses**: Show a list of saved shipping addresses extracted from past orders' `shipping_address` JSONB.
- **Support / Rewards**: Keep as placeholders with "Coming Soon" labels.

### 6. Order Detail Expansion
- Each order in the "Recent Orders" list will be clickable to expand/reveal line items (product name, qty, price each) fetched from `marketplace_order_items` joined with `products_all`.

## Technical Details

### File: `src/pages/portal/CustomerPortal.tsx` (major rewrite)

**New hooks/queries added inline:**
```typescript
// Fetch real orders
const { data: orders, isLoading: ordersLoading } = useQuery({
  queryKey: ['customer-orders', user?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from('marketplace_orders')
      .select(`
        id, created_at, order_type, payment_status, fulfillment_status,
        subtotal, shipping_cost, tax_amount, total, shipping_address, notes,
        items:marketplace_order_items(
          id, qty, price_each,
          product:products_all(id, product_name, images)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    return data || [];
  },
  enabled: !!user,
});
```

**Derived stats (no extra queries):**
- `totalOrders = orders?.length`
- `activeDeliveries = orders?.filter(o => o.fulfillment_status === 'shipped')`
- `uniqueAddresses` = deduplicated from `orders.map(o => o.shipping_address)`

**Order detail expansion:**
- Use local state `expandedOrderId` to toggle showing line items for a clicked order.

**Profile display:**
- Use existing `useCurrentUserProfile()` for name.
- Also fetch from `profiles` table for email/phone to show in an Account Info card.

### File: `src/services/marketplace/useCart.ts` -- No changes needed
The existing `useCart` hook already works for adding products from `/shop`.

### No database migrations needed
All required tables (`marketplace_orders`, `marketplace_order_items`, `products_all`, `profiles`) already exist with proper schema and RLS.

### No new files needed
Everything will be contained in the updated `CustomerPortal.tsx`.

## Summary of Sections in the Updated Page

1. **Account Header** -- Real name, email from profile
2. **Active Delivery Banner** -- Real in-transit orders (if any)
3. **Quick Stats** -- Real total orders count, addresses; rewards marked "Coming Soon"
4. **Action Cards** -- Shop Now (to `/shop`), My Orders (scroll), Cart (to `/cart`), Addresses, Support
5. **Order History** -- Real orders with expandable line items showing product name, qty, price, images
6. **Cart Quick Access** -- Show current cart item count with link to `/cart`

