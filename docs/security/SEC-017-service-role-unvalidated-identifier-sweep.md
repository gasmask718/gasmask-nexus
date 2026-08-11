# SEC-017 — Service-role edge functions that trust a caller-supplied identifier

Status: OPEN (report only — no fixes applied except `outbound-campaign-manager`)
Logged: 2026-08-11

## The shape

An edge function constructs a client with `SUPABASE_SERVICE_ROLE_KEY` (RLS does not
apply), then reads an ownership identifier — `business_id`, `store_id`, `client_id`,
`wholesaler_id`, `ambassador_id`, `va_id`, `user_id` — straight out of the request body
and acts on it. Nothing compares that identifier to the caller's membership, so any
party who can reach the function can operate on any tenant's row by changing one field.

Confirmed instances so far: `outbound-campaign-manager` (fixed), `va-power-dialer` (open).

## Sweep results

Heuristic grep across `supabase/functions/*/index.ts`. Criteria: file references
`SUPABASE_SERVICE_ROLE_KEY` **and** an ownership identifier, and does **not** reference
any of `business_members`, `has_business_role`, `has_role(`, `is_*_staff`, `user_roles`,
`is_sbo_operator`.

| Bucket | Count |
|---|---|
| Service-role functions reading an ownership identifier | 275 |
| — of those, JWT-gated but with no caller-vs-identifier check | **37** |
| — of those, no JWT gate at all **and** invoked from `src/` (browser-reachable) | **126** |

The 37 are the exact `outbound-campaign-manager` shape: authentication without
authorization. Any signed-in user reaches another tenant's data by editing the body.

The 126 are worse in reach and more mixed in nature — the bucket includes genuine
webhooks and cron targets where "no JWT" is correct (`brandaro-stripe-webhook`,
`bland-call-webhook`, `dd-cart-recovery-cron`), but they are invoked from front-end code,
so each needs individual triage rather than a blanket verdict.

### Bucket A — JWT present, no ownership check (37)

accept-crm-invite · ambassador-ai-call · ambassador-direct-call · ambassador-send-sms ·
audit-note-parser · brandaro-start-hosting-subscription · bulk-import-partners ·
crm-inactivity-scanner · dc-bulk-call · dd-create-checkout · dd-stripe-connect-status ·
escalation-handler · executive-decision-engine · executive-directive-manager ·
extract-profile-enrichment · field-portal-comms · finalize-audit-draft ·
finance-signal-scanner · governed-outbound-call · margin-deviation-scanner ·
realtime-kill-switch · reconcile-audit-batch · sbo-auto-bet · send-coaching-to-va ·
send-invoice-sms · send-sms · send-wholesaler-invite · strict-verify-batch ·
style-profile-manager · test-ring · tt-invite-partner · va-analyze-single-call ·
va-live-coach · va-next-call-coach · va-send-intake-invite · va-send-invoice ·
va-stripe-checkout

Highest concern in this bucket, on impact rather than likelihood:
`realtime-kill-switch` and `governed-outbound-call` (compliance controls),
`dd-create-checkout`, `dd-stripe-connect-status`, `va-stripe-checkout`,
`va-send-invoice`, `brandaro-start-hosting-subscription` (money),
`send-sms`, `ambassador-send-sms`, `dc-bulk-call` (outbound comms billed per message),
`accept-crm-invite`, `send-wholesaler-invite`, `tt-invite-partner` (account provisioning).

### Bucket B — no JWT, invoked from `src/` (126)

Full list in the sweep output. Needs per-function triage into: legitimate webhook with
signature verification, legitimate cron with no external caller, or genuinely open.

## Caveats

Grep-based, so both directions of error are possible: a function may validate ownership
through a helper this pattern does not name (false positive), or reference
`business_members` for an unrelated reason while still trusting the body (false negative).
Treat the list as a triage queue, not a verdict per function.
