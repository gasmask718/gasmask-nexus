

# Switch to BizText Basic HTTP GET API

## Overview

Replace the current POST-based API call with a simple **GET request** to `https://textit.biz/sendmsg/`, using query parameters for authentication and message delivery -- matching the BizText Basic HTTP API (Java sample reference).

## What Changes

### 1. Add Two New Secrets

Two new secrets are required (the existing `BIZTEXT_API_KEY` can remain for backward compatibility):

| Secret Name | Value |
|---|---|
| `BIZTEXT_ID` | Your phone number (digits only, no "+" sign) |
| `BIZTEXT_PW` | Your BizText account password |

You'll be prompted to enter these before the function is deployed.

### 2. Rewrite the API Call in `supabase/functions/send-biztext-sms/index.ts`

**Before (POST with Basic auth):**
```text
POST https://www.biztextsolutions.com/api/conversations/new
Authorization: Basic [key]
Body: { to, text }
```

**After (GET with query params):**
```text
GET https://textit.biz/sendmsg/?id={phone}&pw={password}&to={recipient}&text={url_encoded_message}
```

Specific changes to the edge function:
- Replace `BIZTEXT_API_KEY` with `BIZTEXT_ID` and `BIZTEXT_PW` from environment
- Build a URL with query parameters: `id`, `pw`, `to`, `text` (URL-encoded via `encodeURIComponent`)
- Switch from `fetch(..., { method: "POST" })` to a simple `fetch(url)` GET request
- Keep all existing: CORS handling, phone normalization, database logging, error handling
- The response parsing will handle both plain text (e.g., "OK" or error string) and JSON gracefully

### 3. No Frontend Changes Needed

All three callers (`ConversationPanel`, `NewMessageModal`, `CommunicationSMSDashboard`) use `supabase.functions.invoke("send-biztext-sms")` with the same `{ to, message }` body -- no changes required.

## Technical Details

### Edge Function API Call (New Implementation)

```text
// Build GET URL with query params
const url = new URL("https://textit.biz/sendmsg/");
url.searchParams.set("id", BIZTEXT_ID);       // digits-only phone
url.searchParams.set("pw", BIZTEXT_PW);        // account password
url.searchParams.set("to", formattedTo);        // destination number
url.searchParams.set("text", message);          // auto URL-encoded by URLSearchParams

const response = await fetch(url.toString());
```

Using `URL` and `searchParams.set()` ensures proper URL-encoding of the `text` parameter automatically.

### Files Changed

| File | Action |
|---|---|
| `supabase/functions/send-biztext-sms/index.ts` | Edit -- replace POST call with GET to `textit.biz/sendmsg/` |

### Execution Order

1. Request `BIZTEXT_ID` and `BIZTEXT_PW` secrets from user
2. Update the edge function code
3. Deploy the updated function
