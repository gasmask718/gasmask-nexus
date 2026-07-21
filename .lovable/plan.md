## Scope

Add three Supabase Edge Functions for Surplus Funds, mirroring the Real Estate architecture. Lovable Cloud auto-deploys them — no CLI/GitHub Actions step needed.

## Files to create

1. `supabase/functions/sf-send-contract/index.ts`
2. `supabase/functions/sf-assign-attorney/index.ts`
3. `supabase/functions/sf-payment-handler/index.ts`

No changes to `supabase/config.toml` (default `verify_jwt=false` already applies to Lovable-managed functions).

## 1. sf-send-contract

- **Trigger**: POST `{ case_id, contract_type? }` from UI.
- **Template**: `re-send-purchase-contract` (DocuSign JWT flow).
- **Logic**:
  - Load row from `surplus_funds_cases` by `case_id`.
  - Get DocuSign access token; env: `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_SECRET_KEY`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_BASE_URL`, new `DOCUSIGN_TEMPLATE_SF_CLAIM_ID`. If missing → 500 "DocuSign not configured" (same soft-fail pattern as RE).
  - Create envelope with claimant fields (name, property_address, state, court_case_number, surplus_amount, our_percentage).
  - Insert row into `surplus_funds_contracts` with `case_id`, `lead_id`, `claimant_name/email/phone`, `state`, `surplus_amount`, `our_percentage`, `contract_type` (default `claim_agreement`), `status='sent'`, `docusign_envelope_id`.
  - Update `surplus_funds_cases.status='contract_sent'`.
  - Optional SMS to claimant + David via existing `send-sms` function (guarded by `DAVID_PHONE`).
- **Response**: `{ success, contract_id, envelope_id }`.

## 2. sf-assign-attorney

- **Trigger**: POST `{ case_id, attorney_id, attorney_fee_percentage?, notes? }`.
- **Template**: `re-match-buyers` (matching + assignment pattern), simplified.
- **Logic**:
  - Load `surplus_funds_cases` row; verify attorney exists in `surplus_funds_attorneys` and covers the case's `state` (attorney.states array) and is `status='active'`.
  - Insert `surplus_funds_attorney_assignments` (`case_id`, `attorney_id`, `status='pending'`, `attorney_fee_percentage`, `notes`).
  - Update `surplus_funds_cases` with `attorney_id`, `attorney_name`, `status='attorney_assigned'`.
  - Increment `surplus_funds_attorneys.cases_total`.
  - Optional SMS notification to attorney.phone and David.
- **Response**: `{ success, assignment_id }`.

## 3. sf-payment-handler

- **Trigger**: POST from Stripe/manual webhook. Accepts `{ case_id, contract_id?, amount, our_fee_amount?, attorney_fee_amount?, claimant_net_amount?, payment_method?, court_order_date?, disbursement_date?, our_fee_received_date? }`.
- **Template**: `re-docusign-webhook` (webhook shape + idempotent upsert).
- **Logic**:
  - Public endpoint (no JWT). Optional Stripe signature validation via `STRIPE_WEBHOOK_SECRET` if header present (soft-check, mirrors RE pattern).
  - Load case for `claimant_name` and `our_percentage`; compute defaults for fee split if not supplied.
  - Upsert into `surplus_funds_payments` keyed on `(case_id, contract_id)`; set `status='received'` when `our_fee_received_date` present, else `'pending'`.
  - If `disbursement_date` present → update `surplus_funds_cases.funds_released_at` and `amount_received`; set `status='paid'`.
  - Optional SMS to David: "💰 SF payment received: $X — {claimant}".
- **Response**: `{ success, payment_id }`.

## Conventions (all three)

- Use `esm.sh/@supabase/supabase-js@2` with `SUPABASE_SERVICE_ROLE_KEY` (matches RE template).
- Standard CORS headers, `OPTIONS` short-circuit.
- Try/catch with 500 JSON error on failure.
- No new secrets requested in this task; DocuSign secrets are shared with RE. `DOCUSIGN_TEMPLATE_SF_CLAIM_ID` will be requested only if/when SF contract sending is turned on (function returns a clear 500 until then, same as RE).

## Deployment

Lovable Cloud auto-deploys these on save. No manual CLI or GitHub Actions step. I'll confirm each function appears in the deployed list after creation.

## Out of scope

- No frontend wiring (UI buttons to invoke these); can follow in a next task.
- No new tables, no migrations.
- No RLS changes (functions use service role).
