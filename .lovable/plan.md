

# Rewrite `send-biztext-sms` for Biz Text Solutions API

## Summary

Replace the old BizText Basic HTTP GET integration with the new **Biz Text Solutions** POST API. The frontend contract (request body shape, response shape) stays identical so no UI changes are needed.

## What Changes

| Area | Old | New |
|---|---|---|
| API endpoint | `GET https://textit.biz/sendmsg/` | `POST https://www.biztextsolutions.com/api/messages?websiteId=438` |
| Auth | `BIZTEXT_ID` + `BIZTEXT_PW` query params | `Authorization: Bearer {BIZTEXT_TOKEN}` header |
| Payload | URL query string | JSON body: `{ clientNumber, message, customer_id: 149333 }` |
| Success check | Parse raw text for "Err:" | Check for `transmission_status === "SENT"` in JSON response |

## Secret Setup

A new secret **`BIZTEXT_TOKEN`** must be created with your encrypted auth string. The old `BIZTEXT_ID` and `BIZTEXT_PW` secrets will no longer be used.

## Implementation Details

The rewritten `supabase/functions/send-biztext-sms/index.ts` will:

1. **CORS** -- Keep the same preflight handler (unchanged)
2. **Parse request** -- Same frontend contract: `{ to, message, business_id?, store_id?, contact_id?, contact_name? }`
3. **Read secrets** -- Swap `BIZTEXT_ID`/`BIZTEXT_PW` for `BIZTEXT_TOKEN`
4. **Normalize phone** -- Keep existing PH/US phone normalization logic
5. **Call new API** -- `POST` to `https://www.biztextsolutions.com/api/messages?websiteId=438` with:
   - Headers: `Content-Type: application/json`, `Authorization: Bearer {BIZTEXT_TOKEN}`
   - Body: `{ "clientNumber": formattedTo, "message": message, "customer_id": 149333 }`
   - The `Authorization` header key is defined as a constant at the top of the file so you can easily change it later
6. **Response handling**:
   - Parse JSON response
   - If `transmission_status === "SENT"` -> success (status 200, db status "delivered")
   - Otherwise -> throw error with raw response (status 500, db status "failed")
7. **Database logging** -- Unchanged: insert into `communication_messages` and `communication_logs`
8. **Deploy** -- Automatically redeploy the edge function

## Files Changed

| File | Action |
|---|---|
| `supabase/functions/send-biztext-sms/index.ts` | Full rewrite of API call logic (steps 3, 5, 6) |

## No Frontend Changes

The request/response contract is identical, so `NewMessageModal`, `ClickableSMS`, `BulkSMSModal`, and all other callers continue to work without modification.

