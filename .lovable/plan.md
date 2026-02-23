

# Fix BizText "Err:Unauthenticated_User" Error

## Root Cause

The BizText API is rejecting the credentials stored in your secrets. `Err:Unauthenticated_User` means the `BIZTEXT_ID` (your phone number) or `BIZTEXT_PW` (your password) is incorrect.

Additionally, the currently deployed Edge Function does not have the latest error-handling code, so it returns `success: true` even when BizText rejects the request.

## Fix (2 Steps)

### Step 1: Update Your BizText Credentials

You will be prompted to re-enter:

- **BIZTEXT_ID** -- Your BizText account phone number, digits only (no "+" sign, no dashes). Example: `18776818621`
- **BIZTEXT_PW** -- Your BizText account password (the one you use to log into textit.biz)

You can verify your credentials by logging into [textit.biz](https://textit.biz) with them first.

### Step 2: Redeploy the Edge Function

The current deployed version is stale and does not include the error-handling fix from the last edit. Redeploying `send-biztext-sms` will ensure:

- BizText `Err:` responses correctly throw a 500 error (instead of returning `success: true`)
- The frontend shows a proper error toast when credentials fail

### Files Changed

| File | Action |
|---|---|
| `supabase/functions/send-biztext-sms/index.ts` | Redeploy only (no code changes needed -- file already has the fix) |

