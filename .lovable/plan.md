

# Add Phone to Prospects Tab + Fix Build Errors

## 3 Changes

### 1. Update `search_callable_prospects` RPC to return `phone`
The SQL function currently selects `id, store_name, full_address, city, state, discovered_by, created_at` but omits `phone`. Need to add `phone text` to the RETURNS TABLE and include `ta.phone` in both the SELECT and also allow searching by phone.

### 2. Fix `DialerProspectsTab.tsx` duplicate phone display
Line 250 shows `{p.city}, {p.state}, {p.phone}` — this accidentally shows phone in the city/state line. Remove `{p.phone}` from that span since phone already has its own dedicated line (238-242).

### 3. Fix unrelated build errors
- **`BillingInvoices.tsx` line 50**: `startDate`/`endDate`/`sortBy` are passed to `usePaginatedInvoiceFeed` but `PaginatedFilters` (which extends `InvoiceFilters`) doesn't have those fields. Add `startDate`, `endDate`, and `sortBy` to the `PaginatedFilters` interface.
- **`InviteSignup.tsx` line 135**: `"user"` is not in `OSRole` type. Add `'user'` to the `OSRole` union type in `osNavigation.ts`.

