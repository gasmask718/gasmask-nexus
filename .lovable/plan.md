# Twilio / Communications Egress Inventory & Standardization Plan

## Goal
Build a complete, authoritative inventory of every active Twilio and communications egress path in `supabase/functions/`, then standardize on shared chokepoints and clean up credential sprawl.

## Current-state inventory (verified)

| Search scope | Pattern | Matches | Notes |
|---|---|---|---|
| `supabase/functions/` | `twilio` (case-insensitive) | **185 files** | Includes shared helpers, ingress webhooks, admin/health, and dead/legacy functions. |
| Entire codebase | `api.twilio.com` | **108 files** | Direct REST callers (fetch to Twilio). |
| Entire codebase | `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | **114 files** | Env-var consumers. |
| Entire codebase | `messages.create` / `calls.create` | **0 files** | Project does not use the Twilio SDK; all calls are raw `fetch`. |

### Shared egress chokepoints
- **`supabase/functions/send-sms/index.ts`** — canonical SMS sender. Called by ~30+ frontend hooks/pages and edge functions (Brandaro, UT, Real Estate, Surplus Funds, Comms Hub, etc.).
- **`supabase/functions/_shared/twilio-operator.ts`** — shared helper used by voice/call flows; hits `Messages.json` and `Calls.json`.
- **`supabase/functions/_shared/gasmaskVoice.ts`** — GasMask voice/SMS helper.
- **`supabase/functions/_shared/ddAlert.ts`** — Dynasty Direct alerting helper.

### Gateway-routed Twilio callers (Lovable connector gateway)
8 functions route through `https://connector-gateway.lovable.dev/twilio`:
- `ambassador-send-sms`
- `brandaro-execute-calls`
- `brandaro-sms-dispatch`
- `bulk-sms-processor`
- `va-initiate-call`
- `ut-track-ambassador-sale`
- `ut-send-booking-confirmation`
- `fetch-twilio-messages`

### Direct `api.twilio.com` callers by category (108 total)
**Voice / call initiation**
- `twilio-outbound-call`, `twilio-manual-call`, `governed-outbound-call`, `place-outbound-call`, `transfer-campaign-call`, `bland-agent-trigger`, `ambassador-direct-call`, `ambassador-ai-call`, `va-initiate-call`, `test-ring`, `solar-parallel-dialer`, `solar-call-initiate`, `cold-call-tts-blast`, `predictive-dialer-engine`, `dialer-bridge-agent`, `call-live-handoff`, `brandaro-autonomous-executor`, `brandaro-closer-action`, `brandaro-execute-calls`, `brandaro-handle-inbound`, `brandaro-provision-receptionist`, `brandaro-call-twiml`, `brandaro-call-status`, `dc-amd-callback`, `dc-inbound-call`, `dc-bland-dispatch`, `dc-configure-webhook`, `dc-configure-webhooks-bulk`, `provision-dc-number`, `gasmask-ai-caller`, `gasmask-inbound-voice`, `gasmask-missed-call-handler`, `gasmask-call-dial-complete`, `gasmask-trigger-bland-campaign`, `twilio-voice-webhook`, `twilio-voice-twiml`, `twilio-gather-webhook`, `twilio-human-queue-hold`, `twilio-human-call-complete`, `twilio-transfer-choice-webhook`, `twilio-bridge`, `twilio-bridge-fallback`, `twilio-bridge-to-bland`, `twilio-call-events`, `twilio-recording-webhook`, `twilio-recording-callback`, `twilio-status-webhook`, `twilio-campaign-twiml`, `twilio-campaign-confirm`, `twilio-sms-webhook`, `twilio-sms-status`, `twilio-call-status`, `voicemail-webhook`, `cold-call-tts-webhook`, `analyze-va-call`, `va-analyze-single-call`, `analyze-dialer-call`, `dialer-call-status`, `play-twilio-recording`, `start-call-recording`, `transcribe-call-audio`, `fix-twiml-voice-url`, `discover-twiml-apps`, `voice-token-selftest`, `voice-pipeline-audit`, `twilio-voice-token`, `twilio-voice-diagnose`, `brandaro-voice-token`, `brandaro-twilio-creds-check`, `dc-twilio-creds-check`, `validate-twilio-credentials`, `admin-twilio-test`, `check-twilio-health`, `comms-loop-probe`, `comms-feature-prober`, `comms-health-monitor`, `system-health`, `system-health-runner`, `system-health-check`, `t7c-a-dallas-sid-lookup`.

**SMS dispatch**
- `send-sms` (canonical), `_shared/twilio-operator.ts`, `ambassador-notify`, `ambassador-approve-sms`, `ambassador-sale-webhook`, `ut-ambassador-finder`, `ut-growth-engine`, `sbo-send-daily-sms`, `sbo-send-picks-sms`, `sbo-daily-automation`, `tt-smart-dispatch`, `tt-auto-dispatch`, `tt-assign-driver`, `tt-booking-fulfillment`, `tt-finalize-accept`, `tt-nightly-report`, `tt-partner-response`, `tt-release-expired-auths`, `tt-deliverability-test`, `cb-dispatch-engine`, `brandaro-send-followup`, `brandaro-send-followups`, `brandaro-send-demo`, `brandaro-stripe-webhook`, `brandaro-receptionist-checkout`, `brandaro-recording-proxy`, `brandaro-recovery-worker`, `brandaro-sync-recordings`, `brandaro-fetch-recordings`, `brandaro-handle-inbound`, `dd-cart-recovery-cron`, `dd-pay-partner`, `dd-stripe-webhook`, `dd-whatsapp-notify`, `dd-notify-customer-order-update`, `dd-notify-question`, `dd-subscription-fulfillment`, `dd-generate-partner-payouts`, `dd-supplier-scorecard`, `dynasty-recovery-claimant-intake`, `demo-stripe-webhook`, `field-portal-comms`, `messaging-send-worker`, `monitor-ut-ambassador-pipeline`, `nightlife-notify`, `send-approval-sms`, `send-invoice-sms`, `send-invoice-receipt`, `receive-event-booking`, `supplier-send`, `supplier-reply-webhook`, `va-send-intake-invite`, `va-send-invoice`, `check-bill-balances`, `batch-phone-detection`, `detect-number-type`, `fetch-twilio-conversation`, `encrypt-client-ssn`, `dropship-product-scorer`, `relay-sms`, `gasmask-sms-inbound`, `gasmask-order-receipt`, `ut-track-ambassador-sale`, `ut-send-booking-confirmation`.

**Number provisioning / admin**
- `brandaro-provision-receptionist`, `provision-dc-number`, `t7c-a-dallas-sid-lookup`, `discover-twiml-apps`, `fix-twiml-voice-url`, `validate-twilio-credentials`, `admin-twilio-test`, `check-twilio-health`, `voice-pipeline-audit`, `twilio-voice-diagnose`, `system-health`, `system-health-runner`, `system-health-check`, `comms-loop-probe`, `comms-health-monitor`, `comms-feature-prober`.

## Proposed work

### Phase 1 — Categorize and tag
Create a machine-readable inventory file (`docs/infrastructure/twilio-egress-inventory.md`) classifying every Twilio-touching function as:
- `egress-sms`
- `egress-voice`
- `ingress-webhook`
- `admin-health`
- `shared-helper`
- `deprecated-candidate`

### Phase 2 — Consolidate direct callers
For every function in `egress-sms` and `egress-voice` that is not a webhook or admin tool:
1. Route SMS through `send-sms` (or `ambassador-send-sms` for ambassador-scoped sends).
2. Route voice through `_shared/twilio-operator.ts` or `twilio-outbound-call`.
3. Remove duplicated `fetch` blocks to `api.twilio.com`.

### Phase 3 — Credential audit
1. Verify every function reading `TWILIO_ACCOUNT_SID` enforces the `AC…` prefix (per `mem://security/twilio-sid-prefix-standard`).
2. Replace bare `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` with brand-scoped secrets where applicable (`BRANDARO_TWILIO_*`, `UT_TWILIO_*`, etc.).
3. Confirm gateway callers have `LOVABLE_API_KEY` + `TWILIO_API_KEY` available.

### Phase 4 — Deprecate dead functions
Identify functions that are thin forwarders or no longer invoked (e.g., `bland-send-sms` is already marked deprecated) and either delete them or add explicit deprecation headers.

### Phase 5 — Verification
Run the same four searches again and confirm:
- Direct `api.twilio.com` callers drop by at least 50%.
- Zero new `TWILIO_ACCOUNT_SID` consumers appear outside shared helpers.
- `send-sms` and `twilio-operator.ts` remain the only two production egress chokepoints.

## Out of scope
- Refactoring frontend callers (they already invoke `send-sms`).
- Changing Twilio ingress webhooks (signature verification must remain intact).
- Adding new communication channels.

## Success criteria
- A single documented inventory exists.
- All production SMS/call egress flows through `send-sms` or `_shared/twilio-operator.ts`.
- No direct `api.twilio.com` `fetch` remains in business-logic functions.
- All Twilio SIDs start with `AC`.
