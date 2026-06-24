# Bridge admin promotion → UT ambassador activation

## Why the dashboard says "Account Under Review"

`UTAmbassadorDashboard.tsx` gates entry on a row in `unforgettable_ambassadors` matching the logged-in user **and** `status = 'active'`. Admin promotion via `useUserRolesAdmin` only writes to `user_roles` — it never touches `unforgettable_ambassadors`, so the UT dashboard renders the "Account Under Review" card even though the role exists.

## Fix in two parts

### Part A — One-time activation for `tilaplapya.pish@gmail.com`

A data-only step (handled via a migration so it's auditable):

1. Look up the auth user id for `tilaplapya.pish@gmail.com`.
2. Upsert into `unforgettable_ambassadors`:
   - Match on `email` first; if a row exists, set `auth_user_id`, `status='active'`, `approved_at=now()`.
   - If no row exists, insert a new one with `email`, `auth_user_id`, `full_name` (from profile if available), `status='active'`, `approved_at=now()`, and a generated `referral_code`.
3. Verify the existing `user_roles` row with `role='ambassador'` is present; insert if missing.

Result: next login lands directly on the UT ambassador dashboard, no review screen.

### Part B — Permanent bridge so this never happens again

New SECURITY DEFINER RPC `public.bridge_ambassador_role_to_ut(_user_id uuid)`:

- Reads the auth user's email + name from `profiles` / `auth.users`.
- Upserts into `unforgettable_ambassadors`:
  - if a row already matches `auth_user_id` OR `email`, set `status='active'`, `approved_at=now()`, and backfill `auth_user_id`;
  - else insert a fresh active row with a generated `referral_code` (8-char base32).
- Returns the resulting ambassador id.
- Restricted to callers who have `admin` or `owner` via `has_role()`.

Wire it into `useAddUserRole` and `useUpdateUserRole` in `src/hooks/useUserRolesAdmin.ts`:

- After a successful insert/update where the new `role === 'ambassador'`, call `supabase.rpc('bridge_ambassador_role_to_ut', { _user_id })`. Non-fatal — show a toast warning if it returns an error but don't roll back the role assignment.
- Invalidate the `["admin-user-roles"]` query as today.

Also harden the dashboard read-path in `src/pages/ut-ambassador/UTAmbassadorDashboard.tsx`:

- If `unforgettable_ambassadors` lookup returns nothing AND the logged-in user has `role='ambassador'` in `user_roles`, call the bridge RPC once, then refetch. This self-heals any legacy accounts that were promoted before the bridge existed (covers other users who hit the same wall today).

## Technical details

- Migration creates the RPC + does the one-time activation in a single file.
- RPC body uses `SET search_path = public`, `SECURITY DEFINER`, and an explicit `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner')` guard at the top — raises `insufficient_privilege` otherwise.
- `referral_code` generator: `upper(substr(encode(gen_random_bytes(6),'base64'),1,8))` with retry on unique violation.
- No schema changes to `unforgettable_ambassadors` — only data + a new function.
- Frontend changes limited to `src/hooks/useUserRolesAdmin.ts` and `src/pages/ut-ambassador/UTAmbassadorDashboard.tsx`. No UI redesign.

## Out of scope

- The separate generic `ambassadors` table and Dynasty ambassador flow — those already work off `user_roles` and aren't gated by `unforgettable_ambassadors`.
- Email notification to the ambassador on auto-activation (can be added later if you want).
