# Twilio / Communications Egress Inventory

Generated: 2026-08-18
Scope: `supabase/functions/` and supporting frontend callers.

## Executive summary

| Search scope | Pattern | Matches | Notes |
|---|---|---|---|
| `supabase/functions/` | `twilio` (case-insensitive) | **185 files** | Includes shared helpers, ingress webhooks, admin/health, and legacy candidates. |
| Entire codebase | `api.twilio.com` | **108 files** | Direct REST callers. |
| Entire codebase | `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | **114 files** | Env-var consumers. |
| Entire codebase | `messages.create` / `calls.create` | **0 files** | Project does not use the Twilio SDK; all calls are raw `fetch`. |

## Canonical egress chokepoints

These are the only functions/helpers that should initiate outbound Twilio traffic in production. All other business-logic functions should route through them.

| Chokepoint | Type | Endpoints used | Consumers |
|---|---|---|---|
| `supabase/functions/send-sms/index.ts` | Edge function | `POST /Accounts/{sid}/Messages.json` | ~30+ frontend hooks/pages and edge functions. Enforces A2P guard and `AC` SID prefix. |
| `supabase/functions/_shared/twilio-operator.ts` | Shared helper | `POST /Accounts/{sid}/Messages.json`, `POST /Accounts/{sid}/Calls.json` | Voice/call flows (`twilio-outbound-call`, `twilio-manual-call`, `governed-outbound-call`, etc.). |
| `supabase/functions/_shared/gasmaskVoice.ts` | Shared helper | `POST /Accounts/{sid}/Messages.json` | GasMask voice/SMS flows. |
| `supabase/functions/_shared/ddAlert.ts` | Shared helper | `POST /Accounts/{sid}/Messages.json` | Dynasty Direct alerting. |

## Gateway-routed Twilio callers

These 8 functions route through `https://connector-gateway.lovable.dev/twilio` using `LOVABLE_API_KEY` + `TWILIO_API_KEY`:

- `ambassador-send-sms`
- `brandaro-execute-calls`
- `brandaro-sms-dispatch`
- `bulk-sms-processor`
- `fetch-twilio-messages`
- `ut-send-booking-confirmation`
- `ut-track-ambassador-sale`
- `va-initiate-call`

## Direct `api.twilio.com` callers by category

### Voice / call initiation and control (direct REST)

- `analyze-dialer-call`
- `analyze-va-call`
- `ambassador-ai-call`
- `ambassador-direct-call`
- `bland-agent-trigger`
- `brandaro-autonomous-executor`
- `brandaro-call-status`
- `brandaro-call-twiml`
- `brandaro-closer-action`
- `brandaro-execute-calls`
- `brandaro-handle-inbound` — SMS egress converted to `send-sms` (2026-08-22); Twilio API contact now limited to `verifyTwilio` ingress verification
- `brandaro-provision-receptionist`
- `brandaro-recording-proxy`
- `brandaro-retell-webhook`
- `brandaro-sync-recordings`
- `brandaro-voice-token`
- `call-live-handoff`
- `cold-call-tts-blast`
- `dc-amd-callback`
- `dc-bland-dispatch`
- `dc-configure-webhook`
- `dc-configure-webhooks-bulk`
- `dc-inbound-call`
- `dialer-bridge-agent`
- `dialer-call-status`
- `discover-twiml-apps`
- `fix-twiml-voice-url`
- `gasmask-ai-caller`
- `gasmask-call-dial-complete`
- `gasmask-call-recording-status`
- `gasmask-inbound-voice`
- `gasmask-missed-call-handler` — recovery SMS converted to `send-sms` (2026-08-22); no direct message egress remains
- `gasmask-trigger-bland-campaign`
- `gasmask-voicemail-complete`
- `gasmask-voicemail-transcription`
- `governed-outbound-call`
- `place-outbound-call`
- `play-twilio-recording`
- `predictive-dialer-engine`
- `provision-dc-number`
- `solar-call-initiate`
- `solar-parallel-dialer`
- `start-call-recording`
- `test-ring`
- `transcribe-call-audio`
- `transfer-campaign-call`
- `twilio-bridge`
- `twilio-bridge-fallback`
- `twilio-bridge-to-bland`
- `twilio-call-events`
- `twilio-call-status`
- `twilio-campaign-confirm`
- `twilio-campaign-twiml`
- `twilio-gather-webhook`
- `twilio-human-call-complete`
- `twilio-human-queue-hold`
- `twilio-inbound-call`
- `twilio-manual-call`
- `twilio-outbound-call`
- `twilio-recording-callback`
- `twilio-recording-webhook`
- `twilio-sms-status`
- `twilio-sms-webhook`
- `twilio-status-webhook`
- `twilio-transfer-choice-webhook`
- `twilio-voice-diagnose`
- `twilio-voice-token`
- `twilio-voice-twiml`
- `twilio-voice-webhook`
- `va-analyze-single-call`
- `va-dialer-status`
- `va-initiate-call`
- `voicemail-webhook`

### SMS dispatch (direct REST)

- `_shared/ddAlert.ts`
- `_shared/gasmaskVoice.ts`
- `_shared/twilio-operator.ts`
- `ambassador-approve-sms`
- `ambassador-notify`
- `ambassador-sale-webhook`
- `batch-phone-detection`
- `brandaro-create-payment-link`
- `brandaro-fetch-recordings`
- `brandaro-handle-inbound` — converted to `send-sms` (2026-08-22); TwiML `<Message>` reply removed, all egress gated
- `brandaro-recovery-worker`
- `brandaro-receptionist-checkout`
- `brandaro-send-demo`
- `brandaro-send-followup`
- `brandaro-send-followups`
- `brandaro-stripe-webhook`
- `brandaro-sms-dispatch`
- `cb-dispatch-engine`
- `check-bill-balances`
- `cold-call-tts-blast`
- `dd-cart-recovery-cron`
- `dd-generate-partner-payouts`
- `dd-notify-customer-order-update`
- `dd-notify-question` — converted to `_shared/twilioSend` internal class (2026-08-22)
- `dd-pay-partner` — converted to `send-sms` transactional (2026-08-22)
- `dd-stripe-webhook`
- `dd-subscription-fulfillment`
- `dd-supplier-scorecard`
- `dd-whatsapp-notify` — keeps its direct WhatsApp-shaped call, but now carries legal-STOP gate + idempotency + `outbound_messages` audit (2026-08-22)
- `demo-stripe-webhook`
- `detect-number-type`
- `dropship-product-scorer`
- `dynasty-recovery-claimant-intake`
- `encrypt-client-ssn`
- `fetch-twilio-conversation`
- `field-portal-comms`
- `gasmask-order-receipt`
- `gasmask-sms-inbound`
- `messaging-send-worker`
- `monitor-ut-ambassador-pipeline`
- `nightlife-notify`
- `receive-event-booking`
- `relay-sms`
- `send-approval-sms`
- `send-invoice-receipt`
- `send-invoice-sms`
- `send-sms`
- `sbo-daily-automation`
- `sbo-send-daily-sms`
- `sbo-send-picks-sms`
- `sf-lead-import`
- `supplier-reply-webhook`
- `supplier-send`
- `tt-assign-driver`
- `tt-auto-dispatch`
- `tt-booking-fulfillment`
- `tt-deliverability-test`
- `tt-finalize-accept`
- `tt-nightly-report`
- `tt-partner-response`
- `tt-release-expired-auths`
- `tt-smart-dispatch`
- `ut-ambassador-finder`
- `ut-growth-engine`
- `ut-send-booking-confirmation`
- `ut-track-ambassador-sale`
- `va-send-intake-invite`
- `va-send-invoice`

### Admin, health, and diagnostic

- `admin-twilio-test`
- `brandaro-twilio-creds-check`
- `check-twilio-health`
- `comms-feature-prober`
- `comms-health-monitor`
- `comms-loop-probe`
- `dc-twilio-creds-check`
- `system-health`
- `system-health-check`
- `system-health-runner`
- `t7c-a-dallas-sid-lookup`
- `twilio-voice-diagnose`
- `validate-twilio-credentials`
- `voice-pipeline-audit`
- `voice-token-selftest`

## Frontend callers of `send-sms`

These UI surfaces invoke the canonical `send-sms` edge function and do not need direct Twilio access:

- `src/components/brandaro/AIApprovalDrawer.tsx`
- `src/components/brandaro/AITakeoverToggle.tsx`
- `src/components/brandaro/BrandaroLeadCard.tsx`
- `src/components/brandaro/ConversationThread.tsx`
- `src/components/communication/CallSmsPanel.tsx`
- `src/components/communication/InternalMessageModal.tsx`
- `src/components/communication/OutreachActions.tsx`
- `src/components/communication/SendMessageModal.tsx`
- `src/components/store/StoreContactActions.tsx`
- `src/hooks/useAmbassadorComms.ts`
- `src/hooks/useBulkMessageSend.ts`
- `src/hooks/useCommunicationDrafts.ts`
- `src/hooks/useFieldStoreComms.ts`
- `src/hooks/useUTPartnerLeads.ts`
- `src/pages/MasterOpportunities.tsx`
- `src/pages/communication/inbox/InboxPage.tsx`
- `src/pages/communication/manual/ManualTextPage.tsx`
- `src/pages/real-estate/REVADesk.tsx`
- `src/services/templateService.ts`

## Edge-function callers of `send-sms`

These server-side functions invoke `send-sms` rather than calling Twilio directly:

- `admin-notify`
- `ambassador-send-sms`
- `bland-send-sms` (deprecated forwarder)
- `brandaro-conversation-ai`
- `brandaro-pipeline-automator`
- `dynasty-agent-runner`
- `execute-playbook`
- `gasmask-order-receipt`
- `generate-daily-ops-report`
- `invite-va`
- `public-view-security-probe`
- `re-buyer-blast`
- `re-docusign-webhook`
- `re-lead-import`
- `re-send-assignment-agreement`
- `re-send-purchase-contract`
- `relay-sms`
- `send-ambassador-invite`
- `send-booking-reminders`
- `send-invite`
- `sf-assign-attorney`
- `sf-payment-handler`
- `sf-send-contract`
- `va-send-invoice`
- `verify-contact-number`

## Credential posture

- `send-sms` enforces `TWILIO_ACCOUNT_SID.startsWith("AC")` before any outbound request.
- `_shared/twilio-operator.ts`, `_shared/gasmaskVoice.ts`, and `_shared/ddAlert.ts` previously did **not** enforce the `AC` prefix. This was remediated in the same pass that created this inventory.
- Several functions use brand-scoped fallbacks (`BRANDARO_TWILIO_ACCOUNT_SID`, etc.) before the workspace-default `TWILIO_*` secrets.

## Recommended next steps

1. Keep this inventory under version control and update it whenever a new Twilio-touching function is added.
2. Route any new SMS/voice egress through `send-sms` or `_shared/twilio-operator.ts`.
3. Do not add new direct `api.twilio.com` callers in business-logic functions.
4. Periodically re-run the four search queries and confirm the direct-caller count trends down.
