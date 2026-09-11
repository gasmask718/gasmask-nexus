# GasMask — Ambassador / Driver Invitation Email 403

**Date:** 2026-09-12
**Scope:** invitation email delivery only. No territory, visibility, route, claim,
assignment, or identity changes were made. No invitations were sent.

## 1. Invitation path (traced)

Admin UI (`InviteButton` / ambassador invite screens, `supabase.functions.invoke`)
→ edge function `send-ambassador-invite`
→ RPC `create_ambassador_invite` (or resend of an existing pending row)
→ Resend HTTP API `POST https://api.resend.com/emails`
→ From `GasMask <onboarding@resend.dev>` (now `INVITE_FROM_EMAIL` when set)
→ invite URL `https://gasmask-os-nexus.lovable.app/invite/ambassador/<token>`
→ provider response persisted into `ambassador_invite_events.metadata.send_log`.

- Provider: **Resend** (SMS leg is Twilio via `send-sms`; unaffected).
- Sending function: `supabase/functions/send-ambassador-invite`.
- From domain: `resend.dev` (Resend sandbox). No Reply-To is set.
- Env var names used: `RESEND_API_KEY`, `APP_PUBLIC_URL`, `INVITE_FROM_EMAIL` (new),
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Auth/login: **no auth user is created at invite time**. The login is created only
  when the recipient accepts the invite; acceptance grants the `ambassador` role only.
- Status persistence: every attempt writes a `sent` event with the full per-channel
  `send_log`, including `ok:false` and the provider status. A failed send is never
  recorded as delivered; the function returns HTTP 502 when no channel succeeded.

## 2. Actual 403 response

```
PROVIDER:        Resend
HTTP STATUS:     403
ERROR CODE:      validation_error
MESSAGE:         "You can only send testing emails to your own email address
                 (gasmaskapprovedllc@gmail.com). To send emails to other recipients,
                 please verify a domain at resend.com/domains, and change the
                 `from` address to an email using this domain."
FROM ADDRESS:    GasMask <onboarding@resend.dev>
```

**Classification: sender/domain not verified (Resend sandbox restriction).**
Not an API key permission problem, not recipient suppression, not a malformed
request. Confirmed by the one historical success: the only email Resend ever
accepted went to `gasmaskapprovedllc@gmail.com`, the Resend account owner.

## 3. Existing verified email infrastructure — none reusable

- `RESEND_API_KEY` is a **send-only restricted key** (`/domains` returns 401
  `restricted_api_key`), and the account has no verified domain, so every function
  in the project that sends through Resend (`dd-*`, `send-invite`,
  `send-wholesaler-invite`, `_shared/opsAlert.ts`, `_shared/sendEmail.ts`) is under
  the same sandbox limit. They are not "working" senders.
- `SENDGRID_API_KEY` exists but the key has no management scope
  (`/v3/verified_senders` and `/v3/whitelabel/domains` both return 403), so no
  verified SendGrid sender can be confirmed. Not safe to route invites through it.
- Gmail SMTP (`VA_GMAIL_USER` / `VA_GMAIL_APP_PASSWORD`) is documented in
  `_shared/sendEmail.ts` as a fallback whose app password was silently revoked
  (534-5.7.9) from 2026-07-03. Not a trustworthy invite path.
- Lovable Emails is **not set up**: no email domain configured for this project and
  no custom domain on the app.

No second mail system was built.

## 4. Fix applied (application side)

`send-ambassador-invite` no longer hardcodes the sandbox sender. It reads
`INVITE_FROM_EMAIL` and falls back to `GasMask <onboarding@resend.dev>`, matching
the pattern already used by `send-invite`. Deployed. This removes the code-side
blocker so that, the moment a verified sender exists, invites work by setting one
secret — no code change, no new invites, no token churn.

This does **not** by itself fix delivery. The 403 is a provider-account state.

## EXTERNAL ACTION REQUIRED (owner)

One of:

1. **Verify a domain in Resend** at resend.com/domains for a GasMask domain the
   owner controls, add the DNS records **Resend displays for that domain** (Resend
   generates them per-domain — none are recorded here because none were shown to
   this project; the API key is send-only and cannot list them), then set the secret
   `INVITE_FROM_EMAIL` to e.g. `GasMask <invites@yourdomain.com>`.
2. **Or configure a Lovable email domain** for this project (requires a domain the
   owner owns) and move invites onto it.

Until then no ambassador or driver invite can reach any address other than
`gasmaskapprovedllc@gmail.com`.

## 5. Failed invite state (audited, unchanged)

All six roster invites are intact, linked to their pre-created ambassador profile,
tokens unused, and correctly recorded as **not delivered**. No auth user exists for
any of them. **All six expire 2026-09-13 14:49 UTC** and will need a resend (existing
resend path, same profiles) once the sender is verified.

| Ambassador | Email | Profile | Auth/login | Token | Send status | Delivery |
|---|---|---|---|---|---|---|
| Javier Smith | Smithjavier770@gmail.com | yes | none | pending, valid | attempted | failed 403 |
| Shawn Warner / Nutt | WARNERSHAWN628@gmail.com | yes | none | pending, valid | attempted | failed 403 |
| Rufino Vinales | RUFINOVINALES@gmail.com | yes | none | pending, valid | attempted | failed 403 |
| Looney | BOOKLOONEYMAC@gmail.com | yes | none | pending, valid | attempted | failed 403 |
| Chico | DJSKRATCH2007@yahoo.com | yes | none | pending, valid | attempted | failed 403 |
| Oliver | Oliverferminvalenzuela@gmail.com | yes | none | pending, valid | attempted | failed 403 |

One older self-invite to `gasmaskapprovedllc@gmail.com` is pending and already
expired (2026-09-04); left untouched.

No profile was recreated, no token regenerated, no record marked delivered.

## 6/7. Controlled test and mass retry

**Not performed.** The root cause is external and unresolved, so a controlled send
would fail identically, and sending to the Resend account owner would not prove
third-party deliverability. No mass retry attempted. Mooks remains excluded (no
contact). The new Mooez record was not merged with legacy `.MOOEZ`.

## Summary

```
MAIL PROVIDER:              Resend
FROM ADDRESS:               GasMask <onboarding@resend.dev> (now INVITE_FROM_EMAIL-driven)
ROOT CAUSE OF 403:          Sandbox sender — no verified domain on the Resend account
FIX APPLIED:                Sender made configurable via INVITE_FROM_EMAIL; deployed
EXTERNAL ACTION REQUIRED:   Verify a GasMask domain at resend.com/domains (add the DNS
                            records Resend shows) or configure a Lovable email domain,
                            then set INVITE_FROM_EMAIL
CONTROLLED TEST:            BLOCKED
MASS RETRY:                 NOT ATTEMPTED
AMBASSADOR INVITES WORKING: NO
EXACT REMAINING BLOCKER:    No verified sending domain / verified sender identity on
                            the mail provider account
```
