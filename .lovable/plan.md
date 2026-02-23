

# BizText SMS Dashboard - Correct API Integration

## Problem

The current `send-biztext-sms` edge function uses the wrong API endpoint (`https://my.biztextsolutions.com/api/v1/sms/send`) and wrong auth format (`Bearer`). The correct API is:

- **Base URL:** `https://api.textit.biz/`
- **Auth:** `Authorization: Basic [API_KEY]`
- **Header:** `X-API-VERSION: v1`

## Changes

### 1. Fix Edge Function: `supabase/functions/send-biztext-sms/index.ts`

- Change URL to `https://api.textit.biz/sms/send` (or appropriate endpoint)
- Change auth header from `Bearer` to `Basic`
- Add `X-API-VERSION: v1` header
- Keep all existing logging and error handling

### 2. Create SMS Dashboard Page: `src/pages/communication/CommunicationSMSDashboard.tsx`

A professional card-based SMS dashboard with:
- **SMS Composer Card** -- Recipient phone input (international format validation e.g. `9477xxxxxxx`), message textarea with real-time 160-char counter, send button with loading spinner
- **Message History Card** -- Table showing sent messages from `communication_messages` where `channel = 'biztext'`, with columns: recipient, message preview, status badge, timestamp
- **Stats Cards** -- Total sent, delivered, failed counts from the database
- Toast notifications for success/error with API response details

### 3. Update Conversation Panel (no changes needed)

The `ConversationPanel.tsx` already calls `send-biztext-sms` correctly -- the fix is purely in the edge function.

### 4. Add Route for Dashboard

Wire up the new SMS dashboard page in the router.

## Technical Details

### Edge Function Fix

```text
Before:
  URL: https://my.biztextsolutions.com/api/v1/sms/send
  Auth: Bearer {key}

After:
  URL: https://api.textit.biz/sms/send
  Headers:
    Content-Type: application/json
    X-API-VERSION: v1
    Authorization: Basic {key}
```

### Phone Validation

International format validation allowing formats like `9477xxxxxxx` (Sri Lanka) alongside existing PH/US normalization.

### Files Changed

| File | Action |
|------|--------|
| `supabase/functions/send-biztext-sms/index.ts` | Edit -- fix URL, auth, add version header |
| `src/pages/communication/CommunicationSMSDashboard.tsx` | Create -- new SMS dashboard |
| `src/App.tsx` (or router file) | Edit -- add route for SMS dashboard |

