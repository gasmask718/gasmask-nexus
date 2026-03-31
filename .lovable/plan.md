

## Analysis

The existing `submit-ut-ambassador` edge function already handles ambassador submissions correctly — it validates input, checks for duplicates, inserts into `unforgettable_ambassadors` using the service role key, and has proper CORS. It lives in this project (`qalaaroashbggynpvqct`).

The proposed `receive-ut-ambassador` would be a second entry point secured by a shared secret header instead of Supabase auth headers, designed for cross-project calls from the public site.

## Plan

### Step 1 — Create edge function `receive-ut-ambassador`

Create `supabase/functions/receive-ut-ambassador/index.ts` that:
- Validates `x-shared-secret` header against `SHARED_SECRET` env var
- Accepts the same ambassador fields as `submit-ut-ambassador`
- Uses Zod validation (replicating the existing schema)
- Checks for duplicate emails
- Inserts into `unforgettable_ambassadors` with `SUPABASE_SERVICE_ROLE_KEY`
- Includes full CORS support
- Returns structured success/error JSON

### Step 2 — Add secret

Use the `add_secret` tool to request the `SHARED_SECRET` value (you specified `dynasty-ut-2026`).

### Step 3 — Report function URL

After deployment, the function URL will be:
```
https://qalaaroashbggynpvqct.supabase.co/functions/v1/receive-ut-ambassador
```

### Technical Notes

- The function is nearly identical to `submit-ut-ambassador` but replaces JWT/anon-key auth with a simple shared-secret check, making it callable from a different Supabase project without needing this project's keys.
- No changes to any existing files or components.

