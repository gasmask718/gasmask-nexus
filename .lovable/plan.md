

# Fix Message Storage and History on /communication/inbox

## Problem Summary

Messages sent from the inbox are **not being saved to the database**, so message history appears empty. Three distinct bugs were found:

## Root Causes

### Bug 1: Invalid channel value "biztext"
The Edge Function inserts `channel: "biztext"` into `communication_messages`, but the table has a CHECK constraint that only allows: `sms`, `call`, `ai-call`, `ai-sms`, `email`, `whatsapp`. The insert is rejected silently.

**Fix:** Change `channel: "biztext"` to `channel: "sms"` in the Edge Function insert (line 98).

### Bug 2: Missing required "summary" field in communication_logs
The `communication_logs` insert omits the `summary` column, which is NOT NULL. The insert fails.

**Fix:** Add `summary: "Outbound SMS to {phone}"` to the communication_logs insert (line 118-125).

### Bug 3: BizText errors treated as "delivered"
The response `"Err:Unauthenticated_User"` does not contain the word "fail", so the code marks it as "delivered". This means failed sends appear successful.

**Fix:** Expand the error detection to also check for `"err"` in the response text (case-insensitive).

## Changes

### File: `supabase/functions/send-biztext-sms/index.ts`

| Line | Current | Fixed |
|---|---|---|
| 86 | `responseText.toLowerCase().includes("fail")` | `responseText.toLowerCase().includes("fail") \|\| responseText.toLowerCase().startsWith("err")` |
| 98 | `channel: "biztext"` | `channel: "sms"` |
| 119 | `channel: "biztext"` | `channel: "sms"` |
| 118-125 | No `summary` field | Add `summary: "Outbound SMS to " + formattedTo` |

After editing, the function will be re-deployed.

## Outcome
- Sent messages will be correctly saved to `communication_messages` with `channel: "sms"`
- Communication logs will include the required summary
- BizText error responses (like `Err:Unauthenticated_User`) will be correctly flagged as "failed"
- The conversation panel will fetch and display message history as expected (the query already works -- it was just finding no rows because inserts were failing)

