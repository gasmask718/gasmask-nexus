

## Plan: Unify Invoice System + Twilio SMS on Creation + Conversations Integration

### Problem Summary

There are **two disconnected invoice tables**:
1. **`invoices`** — used by Store Profile pages. Has `store_id`. Already sends SMS receipts via `send-invoice-receipt` edge function on creation. Shows in `/billing/invoices` via the unified feed.
2. **`customer_invoices`** — used by `/billing/invoices/new`. Has `customer_id` (links to `crm_customers`). Does NOT send SMS. Shows in `/billing/invoices` via unified feed.

**Gaps:**
- Creating an invoice at `/billing/invoices/new` does not link to any store (uses `crm_customers` only) — so it never shows in a store profile.
- Creating an invoice in a store profile already works and shows in `/billing/invoices` (unified feed merges both tables).
- Neither receipt SMS gets logged to `messaging_messages`, so nothing shows in the Conversations tab.

### Changes

#### 1. Add Store Assignment to `/billing/invoices/new` (BillingInvoiceNew.tsx)
- Add a **Store selector** (optional) alongside the existing Customer selector
- When a store is selected, also insert a row into the `invoices` table (the store invoice table) so it appears in the store profile
- OR simpler: add a `store_id` column to `customer_invoices` so the unified feed can cross-reference. However this breaks the existing architecture.
- **Best approach**: When a store is assigned, insert into `invoices` table instead of `customer_invoices`, using `entity_type='store'` and `entity_id=store.id`. This way it flows through the existing store pipeline including SMS receipt.

**Implementation**: Modify `BillingInvoiceNew.tsx`:
- Add a store search/select dropdown (querying `stores` table)
- If store is selected → insert into `invoices` table with `store_id` and `entity_type='store'` → triggers `send-invoice-receipt` automatically
- If no store (CRM-only) → keep existing `customer_invoices` insert → also trigger receipt SMS via edge function

#### 2. Send SMS for CRM Invoices (customer_invoices)
- After creating a `customer_invoices` record, invoke `send-invoice-receipt` edge function
- The edge function needs a minor update to also handle `customer_invoice_id` and resolve phone from `crm_customers` table (which has a phone field)

#### 3. Update `send-invoice-receipt` Edge Function
- Accept optional `customer_invoice_id` parameter
- When provided, resolve phone from `crm_customers` table
- Update `customer_invoices` receipt fields (receipt_status, receipt_sent_at, etc.)
- After sending SMS, also insert a row into `messaging_messages` table with:
  - `direction: 'outbound'`
  - `body: <the receipt message>`
  - `phone: <normalized phone>`
  - `status: 'sent'` or `'failed'`
  - `twilio_sid: <message SID>`
  - `store_id` (if available)
  - `campaign_id: null` (not a campaign — direct invoice message)
- This makes all invoice receipts visible in the Conversations tab

#### 4. Update Conversations Tab
- Currently groups by `campaign_id + phone`. Invoice receipts have `campaign_id: null`.
- Add support for non-campaign messages (group by phone only when campaign_id is null)
- Show "Invoice Receipt" as the campaign name for these messages

#### 5. Improve Receipt Message Template
- Current message is basic. Upgrade to a professional invoice notification:

```
🧾 Invoice Notification

Hi [Store/Customer Name],

You have a new invoice from Dynasty OS:

📄 Invoice #: [INV-2025-001]
💰 Amount: $[X,XXX.XX]
📅 Date: [Mar 10, 2026]
📅 Due: [Apr 9, 2026]

Payment Methods: Cash, CashApp, Zelle, Check

Thank you for your business!
— Dynasty OS
```

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/BillingInvoiceNew.tsx` | Add store selector; route store-assigned invoices to `invoices` table; invoke receipt edge function for CRM invoices |
| `supabase/functions/send-invoice-receipt/index.ts` | Support `customer_invoice_id`; resolve CRM customer phone; write to `messaging_messages` after send; upgrade message template |
| `src/pages/communication/messaging/ConversationsTab.tsx` | Handle null-campaign messages; show "Invoice Receipt" label |

### What Already Works (No Changes Needed)
- Store invoice creation (`CreateStoreInvoiceModal`) → already writes to `invoices` table → already calls `send-invoice-receipt`
- Unified invoice feed (`usePaginatedInvoiceFeed`) → already merges both tables for `/billing/invoices`
- `InvoiceHistoryCard` → already queries `invoices` table by `store_id`

