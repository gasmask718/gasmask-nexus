# Fix: "Email not Confirmed" after clicking verify link

## Root cause

`src/pages/Auth.tsx` sends signup/resend with `emailRedirectTo: ${origin}/`. The Supabase client (default PKCE flow) drops the user on `/` with a `?code=...` in the URL. `/` is the app's Index route — it doesn't call `exchangeCodeForSession`, so the code is never exchanged, the email never gets confirmed, and the next sign‑in fails with `Email not confirmed`. PKCE also fails silently if the link is opened in a browser that doesn't have the original `code_verifier` in localStorage.

## Fix

### 1. Dedicated callback route `/auth/callback`

New file `src/pages/auth/AuthCallback.tsx`:
- Parse `window.location` for a `code` query param (PKCE) or an `#access_token=` hash (implicit / recovery links).
- If `code` present → `supabase.auth.exchangeCodeForSession(code)`.
- If hash tokens present → `supabase.auth.setSession({ access_token, refresh_token })`.
- On success: `toast.success('Email verified')` and navigate to `/` (role router takes over).
- On error: navigate to `/auth?verify=failed&reason=<msg>` so the sign‑in page can surface it and offer resend.
- Render a small centered spinner while running.

Register the route in `src/routes/AppRoutes.tsx` as a public route (before the ProtectedRoute tree), path `/auth/callback`.

### 2. Point every verification link at the callback

In `src/pages/Auth.tsx` change both `emailRedirectTo` values (signup + resend) to:
```
`${window.location.origin}/auth/callback`
```
Also audit and update the other signup entry points that already exist so their verify links land on the same handler:
- `src/pages/auth/StoreSignupPage.tsx` (`emailRedirectTo: '/owner'` → `/auth/callback?next=/owner`)
- `src/pages/auth/InviteSignup.tsx` and `src/pages/va/VAAuthPage.tsx` — same treatment, preserving their post‑verify destination via a `next` query param the callback honors.

The callback reads `next` (validated as a same‑origin relative path) and redirects there after exchange; otherwise it falls through to `/` and the role router decides.

### 3. Error handling + inline Resend on the sign‑in form

In `src/pages/Auth.tsx`:
- Add `const [needsConfirm, setNeedsConfirm] = useState(false)`.
- In `handleSignIn`, if `error.message` matches `/email not confirmed/i` (or `error.code === 'email_not_confirmed'`), set `needsConfirm = true` and show a targeted toast: *"Your email isn't confirmed yet."* Other errors keep the current generic toast.
- Below the sign‑in submit button, when `needsConfirm` is true, render a highlighted block:
  - message: "We haven't verified this email yet."
  - primary button "Resend verification email" wired to the existing `handleResendConfirmation` (already implemented — just promote it from the tiny secondary link into a real button in this state).
- On mount, read `?verify=failed` from the URL. If present, set `needsConfirm = true` and toast the reason so users returning from a broken callback see the resend button immediately.
- Clear `needsConfirm` whenever the email field changes.

### 4. Do NOT auto‑log‑in from the callback beyond what `exchangeCodeForSession` already does

`exchangeCodeForSession` establishes the session itself. The existing `AuthProvider` `onAuthStateChange` listener will pick it up and the `useEffect` in `Auth.tsx` / role router will route the user — no extra sign‑in call needed. This matches the project's existing auth pattern and avoids the `await`‑inside‑`onAuthStateChange` deadlock warning.

## Files touched

- **new** `src/pages/auth/AuthCallback.tsx`
- `src/routes/AppRoutes.tsx` — register `/auth/callback`
- `src/pages/Auth.tsx` — redirect URL, `needsConfirm` state, inline resend block, URL‑param handling
- `src/pages/auth/StoreSignupPage.tsx` — `emailRedirectTo` → callback with `next=/owner`
- `src/pages/auth/InviteSignup.tsx` — same treatment
- `src/pages/va/VAAuthPage.tsx` — same treatment (only the email redirect URL, not the VA invite acceptance logic)

## Out of scope

- No changes to `AuthContext` internals, `onAuthStateChange`, or role routing.
- No changes to password‑reset flow (`/reset-password` already exists).
- No changes to Supabase project auth settings.

## Summary

Add `/auth/callback` that exchanges the PKCE code (or sets session from hash tokens), point every `emailRedirectTo` at it, and give the sign‑in form an inline "Resend verification email" button when the user hits `Email not confirmed`.