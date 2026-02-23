

# BizText Integration for Communication Inbox

## Overview

Replace the current Twilio SMS sending in the `/communication/inbox` page with BizText Solutions (`biztextsolutions.com`). The inbox will send messages through a new `send-biztext-sms` backend function while keeping the same conversation UI and database logging.

## What We Need From You

Before building, we need your **BizText API Key** -- we'll securely store it in your backend so it's never exposed in the app code. Since the exact API endpoint details aren't publicly documented, we'll also need you to confirm the send endpoint URL (usually found in your BizText dashboard under API/Integrations settings). A common pattern is:

```
POST https://my.biztextsolutions.com/api/v1/sms/send
```

If you can't find it, we'll build with the most likely format and adjust after testing.

## Implementation Steps

### Step 1: Store the BizText API Key as a Secret

- Use the secret management tool to securely request your BizText API key
- Stored as `BIZTEXT_API_KEY` in your backend secrets

### Step 2: Create `send-biztext-sms` Backend Function

A new backend function that:
- Accepts `to` (phone number), `message`, and optional `contact_id`, `contact_name`, `business_id`, `store_id`
- Calls the BizText API via HTTP POST with API key authentication
- Logs the message to `communication_messages` table (same as current Twilio flow)
- Logs to `communication_logs` for audit trail
- Returns success/failure status

### Step 3: Update the Inbox Conversation Panel

Modify `src/components/communication/inbox/ConversationPanel.tsx`:
- Change `handleSend` to call `send-biztext-sms` instead of `send-sms` (Twilio)
- Keep the same UI, real-time subscriptions, and message display
- Add a "BizText" channel badge on outbound messages sent via BizText

### Step 4: Register the Function in Config

Add `send-biztext-sms` to the backend function configuration with JWT verification disabled (validated in code).

## What Stays the Same

- Contact list / contacts panel (no changes)
- Message history display and real-time updates
- Database tables (`communication_messages`, `communication_logs`)
- Inbound message handling (BizText inbound webhooks can be added later)
- All other SMS features (bulk SMS, call center messages) remain on Twilio

## Technical Details

### New File: `supabase/functions/send-biztext-sms/index.ts`

- CORS headers for web app calls
- Reads `BIZTEXT_API_KEY` from `Deno.env.get()`
- POST to BizText API endpoint with API key in header or query param
- Inserts into `communication_messages` with `channel: 'biztext'` to distinguish from Twilio SMS
- Inserts into `communication_logs` with `channel: 'biztext'`
- Full error handling with structured JSON responses

### Modified File: `src/components/communication/inbox/ConversationPanel.tsx`

- Line 118: Change `supabase.functions.invoke("send-sms", ...)` to `supabase.functions.invoke("send-biztext-sms", ...)`

### Modified File: `supabase/config.toml`

- Add `[functions.send-biztext-sms]` with `verify_jwt = false`

## Files Changed

| File | Action |
|------|--------|
| `supabase/functions/send-biztext-sms/index.ts` | Create |
| `src/components/communication/inbox/ConversationPanel.tsx` | Edit (1 line) |
| `supabase/config.toml` | Edit (add function config) |

