# D2 — EMAIL AUDIT (Pass D)

Tagging: [V] verified, [I] inferred, [U] unknown.

## One-line answer
Email exists as a scattering of per-function send calls across two unrelated
providers (Resend for Dynasty Direct/grants, Gmail SMTP for Brandaro/VA) with
no shared log table, no shared suppression, and no inbound receiving at all.

## SENDING

### Providers in use
- **Resend (HTTP API)** [V] — 13 functions POST directly to `https://api.resend.com/emails`:
  `dd-send-email`, `dd-process-email-jobs`, `dd-contact`, `dd-notify-question`,
  `dd-notify-supplier-order`, `dd-notify-customer-order-update`,
  `dd-supplier-scorecard`, `dd-send-referral-invite`, `make-grant-webhook`,
  `grant-auto-pipeline`, `submit-grant-application`, `send-invite`,
  `send-ambassador-invite`.
- **Gmail SMTP via nodemailer** [V] — `supabase/functions/_shared/sendEmail.ts:3,26-38`.
  Credentials `VA_GMAIL_USER` / `VA_GMAIL_APP_PASSWORD`. Default From:
  `Brandaro <VA_GMAIL_USER>`. Used by `va-send-email`, `va-send-invoice`,
  `va-send-intake-invite`, `clipper-approved-email` and others (~30 functions
  reference an email send path in total) [V].
- No SendGrid, SES, Postmark, or Lovable Emails infrastructure in the repo [V].
- **Lovable Emails is not set up** — no `email_send_log`, `email_send_state`,
  `suppressed_emails`, or `email_unsubscribe_tokens` tables exist
  (`to_regclass('public.email_send_log')` → NULL) [V].

### Transactional vs marketing separation
Not separated [V]. `email_jobs` (5 rows, last 2026-07-09) is the only queue and it
carries both order notifications and campaign-style sends. Everything else sends
inline from whichever function needs it.

### Domains / SPF / DKIM / DMARC
- Resend sends default to `Dynasty Direct <orders@dynastydirect.com>`
  (`dd-send-email/index.ts:11`) [V].
- Gmail SMTP sends from whatever Google account `VA_GMAIL_USER` holds [V].
- **DNS auth state: [U]** — SPF/DKIM/DMARC cannot be verified from the repo or DB.
  Two different sending identities on two different infrastructures means at best
  one of them is aligned. Gmail-SMTP sending under a Brandaro display name from a
  gmail.com envelope is a deliverability and spoofing-perception problem [I].

### Warm-up / rotation / volume control
None [V]. No per-domain rate limiter, no send-volume ceiling, no warm-up schedule
anywhere in the email path. (Contrast: the *phone* side has `warming_until`,
`warming_daily_cap`, `daily_call_cap` columns on `dc_phone_numbers`.)

### Suppression
- `dd_email_suppressions` — **1 row** [V]. Dynasty Direct only.
- It is **not** connected to the SMS/voice suppression path. `_shared/dnc.ts`
  `isSuppressed()` queries `dnc_list` + `opt_out_events` (phone only) and is
  imported by exactly two functions, both telephony: `send-sms`,
  `twilio-outbound-call` [V].
- The Gmail SMTP path (`_shared/sendEmail.ts`) checks **no suppression list at
  all** before sending [V].

### One-click unsubscribe (RFC 8058)
Partial [V]. `dd-process-email-jobs/index.ts:329` sets a `List-Unsubscribe`
header. It does **not** set `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
so it is not RFC 8058 compliant, and it is the only sender that sets the header
at all. `dd-email-unsubscribe` is the landing function.

### Bounce / complaint webhook
None [V]. No Resend webhook endpoint exists; nothing writes bounces or complaints
into `dd_email_suppressions`. Its single row is manual or seed data.

## RECEIVING
Nothing receives email [V]. No inbound-email function, no MX/parse webhook, no
IMAP poller. `brandaro-handle-inbound` advertises "inbound SMS/email replies" in
its doc comment (line 12) but only ever parses Twilio SMS form fields.
**Email replies are lost.** They land in the Gmail mailbox behind
`VA_GMAIL_USER` and in whatever inbox `orders@dynastydirect.com` forwards to —
neither is read by the platform.

## TEMPLATES
- Dynasty Direct: rendered by `renderTemplate()` inside `dd-process-email-jobs`,
  DB/edge driven, not versioned [V].
- Everywhere else: HTML string literals inline in each edge function [V].
- **CAN-SPAM: no physical postal address in any template inspected** [V]; only
  the DD job path carries an unsubscribe link [V].

## LOGGING
- No unified email log [V]. `communication_logs` holds **12 email rows, all
  outbound, newest 2025-12-27** — i.e. the channel is effectively unused [V].
- `email_jobs` (5 rows) is a queue, not a log. `investor_email_logs` 0 rows,
  `call_center_emails` 0 rows, `email_captures` 0 rows [V].
- So email is **not** on the same timeline as calls and SMS.

## Bottom line
Email is a set of one-off send calls, not a system. It has no log, no shared
suppression, no bounce handling, no inbound, and split sender identity across two
providers. Before the lead engine leans on email, it needs one sender path, one
log table, and suppression joined to the phone-side gate.
