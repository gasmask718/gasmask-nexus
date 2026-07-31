# 02_TRACE_MAP — Full trace for every LIVE dispatcher

One block per reachable dispatcher. `egress` = what it actually calls on the wire (verified by source grep). `log_tables` = tables it INSERTs into. `rows_90d` = max recent row count across those tables.

Live dispatchers traced: **82**

## G0-shared-transport-libs
### `_shared/gasmaskVoice.ts`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: none | called-by-fn: gasmask-inbound-voice + 4 gasmask callbacks | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: communication_logs — rows 90d: 1431 (recent)
- dependencies: ok

### `_shared/twilio-operator.ts`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: none | called-by-fn: twilio-voice-webhook, twilio-sms-webhook (DB-configured inbound targets), comms-health-monitor | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;twilio-call
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

## G1-bland-campaign-triggers
### `re-trigger-bland-campaign`
- disposition: **GATE-NOW** | provider: bland | gate today: NO-GATE
- trigger — ui: src/pages/real-estate/RELeadPipeline.tsx:367 | cron: YES | webhook: none | called-by-fn: supabase/functions/_shared/dc_sync_log.ts:10;supabase/functions/_shared/dc_sync_log.ts:10 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: bland;calls:dc-bland-webhook
- log tables: dc_campaigns,dc_leads — rows 90d: 996 (recent)
- dependencies: ok

### `sf-trigger-bland-campaign`
- disposition: **GATE-NOW** | provider: bland | gate today: NO-GATE
- trigger — ui: src/pages/surplus-funds/SFLeadPipeline.tsx:339;src/pages/surplus-funds/SFAutomation.tsx:123 | cron: none | webhook: none | called-by-fn: supabase/functions/_shared/dc_sync_log.ts:9;supabase/functions/_shared/dc_sync_log.ts:9 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: bland;calls:dc-bland-webhook
- log tables: dc_campaigns,dc_leads — rows 90d: 996 (recent)
- dependencies: ok

## G2-bland-direct
### `ambassador-ai-call`
- disposition: **GATE-NOW** | provider: bland | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: none | called-by-fn: supabase/functions/comms-feature-prober/index.ts:34 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: bland
- log tables: ambassador_activity_log,communication_logs — rows 90d: 1431 (recent)
- dependencies: ok

### `bland-start-call`
- disposition: **GATE-NOW** | provider: bland | gate today: NO-GATE
- trigger — ui: src/pages/bland-dial/BlandDialHubPage.tsx:228 | cron: none | webhook: none | called-by-fn: supabase/functions/bland-send-sms/index.ts:3;supabase/functions/comms-feature-prober/index.ts:39 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: bland;calls:bland-agent-webhook,bland-send-sms
- log tables: bland_call_logs,bland_leads — rows 90d: 3549 (recent)
- dependencies: ok

### `brandaro-ai-caller`
- disposition: **GATE-NOW** | provider: bland | gate today: NO-GATE
- trigger — ui: src/components/brandaro/BrandaroLeadCard.tsx:96;src/components/brandaro/BrandaroLeadAssignmentButtons.tsx:33 | cron: none | webhook: none | called-by-fn: supabase/functions/brandaro-execute-calls/index.ts:195;supabase/functions/comms-feature-prober/index.ts:41 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: bland;calls:bland-agent-webhook
- log tables: brandaro_ai_calls — rows 90d: 277 (recent)
- dependencies: ok

### `bulk-ai-call-processor`
- disposition: **GATE-NOW** | provider: bland | gate today: NO-GATE
- trigger — ui: src/hooks/useBulkOutreach.ts:153;src/hooks/useBulkOutreach.ts:217 | cron: YES | webhook: none | called-by-fn: supabase/functions/comms-feature-prober/index.ts:38 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: bland
- log tables: ambassador_activity_log,communication_logs — rows 90d: 1431 (recent)
- dependencies: ok

### `twilio-bridge-to-bland`
- disposition: **GATE-LATER** | provider: bland | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: none | called-by-fn: supabase/functions/twilio-campaign-confirm/index.ts:2;supabase/functions/twilio-campaign-confirm/index.ts:102 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: bland;calls:bland-agent-webhook,twilio-bridge-fallback,twilio-recording-callback
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

## G3-outbound-voice-twilio
### `ambassador-direct-call`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/ambassador/AmbassadorCommunications.tsx:256 | cron: none | webhook: none | called-by-fn: supabase/functions/comms-feature-prober/index.ts:33 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-call
- log tables: ambassador_activity_log,communication_logs — rows 90d: 1431 (recent)
- dependencies: ok

### `bland-agent-trigger`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/communication/dialer/CampaignWizardPage.tsx:499;src/pages/communication/dialer/CampaignDialPage.tsx:6 | cron: none | webhook: none | called-by-fn: supabase/functions/dispatch-campaign-tick/index.ts:7;supabase/functions/dispatch-campaign-tick/index.ts:79 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-call
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

### `brandaro-autonomous-executor`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;twilio-call;calls:twilio-voice-handler
- log tables: brandaro_automation_log,brandaro_contact_limits,brandaro_execution_log,brandaro_lead_memory,communication_logs — rows 90d: 1431 (recent)
- dependencies: ok

### `brandaro-closer-action`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/hooks/useBrandaroCloserActions.ts:19;src/pages/brandaro/FollowUpEnginePage.tsx:66 | cron: none | webhook: none | called-by-fn: supabase/functions/brandaro-auto-striker/index.ts:318;supabase/functions/brandaro-auto-striker/index.ts:350 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;twilio-call;calls:twilio-voice-handler
- log tables: communication_logs — rows 90d: 1431 (recent)
- dependencies: ok

### `brandaro-execute-calls`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/brandaro/BrandaroActivationCenter.tsx:135 | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-call;calls:brandaro-call-status,brandaro-call-twiml
- log tables: brandaro_call_logs — rows 90d: 0 (none-90d)
- dependencies: ok

### `cold-call-tts-blast`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/hooks/useColdCallBlast.ts:169;src/hooks/useColdCallBlast.ts:204 | cron: none | webhook: none | called-by-fn: supabase/functions/comms-feature-prober/index.ts:45 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-call;11labs;calls:cold-call-tts-webhook,twilio-call-status
- log tables: cold_call_campaigns,cold_call_items,manual_call_logs — rows 90d: 0 (none-90d)
- dependencies: ok

### `field-portal-comms`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/hooks/useFieldStoreComms.ts:11;src/hooks/useFieldStoreComms.ts:75 | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;twilio-call
- log tables: ambassador_activity_log,communication_logs — rows 90d: 1431 (recent)
- dependencies: ok

### `gasmask-ai-caller`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/MasterOpportunities.tsx:490 | cron: none | webhook: none | called-by-fn: supabase/functions/gasmask-trigger-bland-campaign/index.ts:7;supabase/functions/gasmask-trigger-bland-campaign/index.ts:199 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-call
- log tables: communication_logs — rows 90d: 1431 (recent)
- dependencies: ok

### `place-outbound-call`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/hooks/useOutboundCall.ts:98;src/components/portal/field/StoreCallTextButtons.tsx:24 | cron: none | webhook: none | called-by-fn: supabase/functions/comms-feature-prober/index.ts:31 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-call;calls:twilio-bridge,twilio-call-status
- log tables: admin_audit_log,call_recordings,manual_call_logs — rows 90d: 0 (none-90d)
- dependencies: ok

### `solar-call-initiate`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/solar/SolarLiveCallAssist.tsx:103 | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-call;calls:twilio-call-status,twilio-elevenlabs-bridge,twilio-gather-webhook
- log tables: solar_interactions — rows 90d: 0 (none-90d)
- dependencies: ok

### `solar-parallel-dialer`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/components/dialer/BatchDialerPanel.tsx:162;src/components/dialer/BatchDialerPanel.tsx:168 | cron: none | webhook: none | called-by-fn: supabase/functions/comms-feature-prober/index.ts:42 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-call;calls:twilio-call-status,twilio-elevenlabs-bridge
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

### `transfer-campaign-call`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/components/communication/ManualCampaignCallModal.tsx:697 | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-call;calls:twilio-call-status,twilio-elevenlabs-bridge,twilio-human-call-complete,twilio-recording-callback
- log tables: call_recordings,live_call_transcripts — rows 90d: 0 (none-90d)
- dependencies: ok

### `twilio-manual-call`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/communication/manual/ManualCallPage.tsx:168;src/pages/communication/dialer/CampaignWizardPage.tsx:495 | cron: none | webhook: none | called-by-fn: supabase/functions/comms-feature-prober/index.ts:32 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-call;calls:twilio-call-status
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

### `va-initiate-call`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: none | called-by-fn: supabase/functions/comms-feature-prober/index.ts:36 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-call
- log tables: va_call_logs — rows 90d: 0 (none-90d)
- dependencies: ok

## G4-generic-sms-senders
### `bulk-sms-processor`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/hooks/useBulkOutreach.ts:153;src/hooks/useBulkOutreach.ts:217 | cron: YES | webhook: none | called-by-fn: supabase/functions/bulk-ai-call-processor/index.ts:2;supabase/functions/comms-feature-prober/index.ts:48 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: ambassador_activity_log,communication_messages — rows 90d: 0 (none-90d)
- dependencies: ok

### `cb-dispatch-engine`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/hooks/useCBDispatchEngine.ts:45;src/hooks/useCBDispatchEngine.ts:64 | cron: none | webhook: none | called-by-fn: supabase/functions/tt-smart-dispatch/index.ts:548;supabase/functions/tt-smart-dispatch/index.ts:581 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: cb_auto_evaluations,cb_communication_logs,cb_partner_quotes,cb_partner_response_tokens,cb_quote_selection_events,cb_request_partner_dispatches — rows 90d: 0 (none-90d)
- dependencies: ok

### `dynasty-recovery-claimant-intake`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: external site POST | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;calls:bland-agent-trigger
- log tables: surplus_funds_leads — rows 90d: 4242 (recent)
- dependencies: ok

### `gasmask-missed-call-handler`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: none | called-by-fn: supabase/functions/dc-inbound-call/index.ts:12;supabase/functions/dc-inbound-call/index.ts:136 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: communication_logs — rows 90d: 1431 (recent)
- dependencies: ok

### `messaging-send-worker`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: none | called-by-fn: supabase/functions/comms-feature-prober/index.ts:55;supabase/functions/messaging-launch/index.ts:160 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: messaging_messages — rows 90d: 8 (recent)
- dependencies: ok

### `monitor-ut-ambassador-pipeline`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/os/unforgettable/UTAmbassadorManagement.tsx:301 | cron: YES | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;calls:run-ut-ambassador-pipeline-test
- log tables: pipeline_health_logs,system_operation_logs — rows 90d: 8804 (recent)
- dependencies: ok

### `nightlife-notify`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/os/toptier/penthouse/PenthouseNightlife.tsx:124 | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

### `receive-event-booking`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: external site POST | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: ut_event_bookings — rows 90d: 2 (recent)
- dependencies: ok

### `send-approval-sms`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/os/unforgettable/UTStaffManagement.tsx:17;src/pages/os/unforgettable/UTVenuesManagement.tsx:17 | cron: none | webhook: none | called-by-fn: supabase/functions/comms-feature-prober/index.ts:59 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

### `send-invoice-receipt`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/BillingInvoiceNew.tsx:105;src/pages/BillingInvoiceNew.tsx:147 | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: invoice_receipt_log,messaging_messages — rows 90d: 8 (recent)
- dependencies: ok

### `send-invoice-sms`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/services/invoice/sendInvoiceSms.ts:25;src/services/invoice/sendInvoiceSms.ts:33 | cron: none | webhook: none | called-by-fn: supabase/functions/comms-feature-prober/index.ts:58 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: communication_logs — rows 90d: 1431 (recent)
- dependencies: ok

### `sf-lead-import`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/surplus-funds/SFDiscovery.tsx:68 | cron: YES | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;calls:sf-trigger-bland-campaign
- log tables: re_automation_log,surplus_funds_leads — rows 90d: 4242 (recent)
- dependencies: ok

### `solar-followup-sender`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: YES | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;calls:solar-followup-ai-generator
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: MISSING:solar_master_leads

### `supplier-reply-webhook`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/os/unforgettable/UTSupplierInboxV2.tsx:141 | cron: none | webhook: Twilio-SMS(external cfg) | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: ut_supplier_messages — rows 90d: 0 (none-90d)
- dependencies: ok

### `supplier-send`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/os/unforgettable/UTAutoOutreach.tsx:98;src/pages/os/unforgettable/UTSupplierInboxV2.tsx:91 | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: ut_supplier_messages — rows 90d: 0 (none-90d)
- dependencies: ok

### `va-send-intake-invite`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/components/va/VANewLeadIntakeForm.tsx:350;src/components/va/VAIntakeInvitesPanel.tsx:141 | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: outbound_messages,va_intake_invites — rows 90d: 822 (recent)
- dependencies: ok

## G5-toptier-sms-notify
### `tt-assign-driver`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/os/toptier/TTDispatch.tsx:103 | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: tt_notifications_log — rows 90d: 0 (none-90d)
- dependencies: ok

### `tt-auto-dispatch`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: tt_dispatch_requests,tt_notifications_log — rows 90d: 44 (recent)
- dependencies: MISSING:partners+tt_service_partners+vehicles

### `tt-booking-fulfillment`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/hooks/useBookingFulfillment.ts:26 | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: tt_booking_events,tt_broadcast_quotes,tt_confirmation_requests — rows 90d: 0 (none-90d)
- dependencies: ok

### `tt-finalize-accept`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: none | called-by-fn: supabase/functions/admin-notify/index.ts:7;supabase/functions/tt-claim-via-link/index.ts:4 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;calls:admin-notify
- log tables: tt_notifications_log — rows 90d: 0 (none-90d)
- dependencies: ok

### `tt-partner-response`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: inbound-SMS reply | called-by-fn: supabase/functions/tt-finalize-accept/index.ts:3;supabase/functions/tt-finalize-accept/index.ts:9 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;calls:tt-finalize-accept
- log tables: tt_notifications_log — rows 90d: 0 (none-90d)
- dependencies: ok

### `tt-release-expired-auths`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: YES | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: tt_notifications_log — rows 90d: 0 (none-90d)
- dependencies: ok

### `tt-smart-dispatch`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/os/toptier/TTBookings.tsx:263;src/pages/os/toptier/TTDispatchRequests.tsx:84 | cron: none | webhook: none | called-by-fn: supabase/functions/admin-notify/index.ts:9;supabase/functions/create-tt-booking/index.ts:163 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;calls:admin-notify
- log tables: tt_dispatch_requests,tt_dispatch_tokens,tt_notifications_log — rows 90d: 44 (recent)
- dependencies: MISSING:partners

## G6-dynastydirect-sms-notify
### `dd-cart-recovery-cron`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/dynasty-direct/DDAnalytics.tsx:112 | cron: YES | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: email_jobs — rows 90d: 5 (recent)
- dependencies: ok

### `dd-generate-partner-payouts`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/dynasty-direct/DDPartnerCampaigns.tsx:879 | cron: YES | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: dd_partner_payouts — rows 90d: 0 (none-90d)
- dependencies: ok

### `dd-notify-customer-order-update`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/dynasty-direct/DDPurchaseOrders.tsx:671;src/pages/dynasty-direct/DDOrderDetail.tsx:138 | cron: none | webhook: none | called-by-fn: supabase/functions/dd-grabba-bridge/index.ts:167;supabase/functions/dd-whatsapp-webhook/index.ts:128 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

### `dd-pay-partner`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/dynasty-direct/DDPartnerCampaigns.tsx:860 | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

### `dd-stripe-webhook`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: Stripe | called-by-fn: supabase/functions/dd-create-checkout/index.ts:209;supabase/functions/dd-notify-customer-order-update/index.ts:2 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;calls:dd-notify-customer-order-update
- log tables: dd_disputes,dd_partner_earnings,dd_webhook_events — rows 90d: 0 (none-90d)
- dependencies: ok

### `dd-subscription-fulfillment`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/components/dynasty-direct/StoreSubscriptionsTab.tsx:65 | cron: YES | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: marketplace_order_items,marketplace_orders — rows 90d: 21 (recent)
- dependencies: ok

### `dd-supplier-scorecard`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/components/dynasty-direct/ScorecardHistory.tsx:40 | cron: YES | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

### `dd-whatsapp-notify`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/dynasty-direct/DDSupplierPerformance.tsx:525 | cron: none | webhook: none | called-by-fn: supabase/functions/dd-notify-supplier-order/index.ts:192 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

## G7-brandaro-sms
### `brandaro-create-payment-link`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/brandaro/VACommandCenterPage.tsx:255;src/pages/brandaro/ClientDemoViewPage.tsx:107 | cron: none | webhook: none | called-by-fn: supabase/functions/brandaro-send-followups/index.ts:178;supabase/functions/brandaro-send-followups/index.ts:183 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

### `brandaro-handle-inbound`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: Twilio(via comms-health-monitor probe/inbound) | called-by-fn: supabase/functions/comms-health-monitor/index.ts:54;supabase/functions/comms-health-monitor/index.ts:423 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: brandaro_inbound_messages — rows 90d: 47 (recent)
- dependencies: ok

### `brandaro-provision-receptionist`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/brandaro/BrandaroReceptionistClientDetail.tsx:89 | cron: none | webhook: none | called-by-fn: supabase/functions/brandaro-receptionist-webhook/index.ts:126 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;retell;calls:brandaro-retell-webhook
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

### `brandaro-receptionist-checkout`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/components/brandaro/SendReceptionistLinkModal.tsx:76;src/pages/brandaro/BrandaroReceptionistHub.tsx:135 | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

### `brandaro-recovery-worker`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: YES | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: brandaro_closer_alerts,communication_logs — rows 90d: 1431 (recent)
- dependencies: ok

### `brandaro-retell-webhook`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: Retell | called-by-fn: supabase/functions/brandaro-provision-receptionist/index.ts:16 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

### `brandaro-send-demo`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/brandaro/DemoEnginePage.tsx:169;src/pages/brandaro/BuilderHubPage.tsx:95 | cron: none | webhook: none | called-by-fn: supabase/functions/brandaro-retry-jobs/index.ts:47;supabase/functions/brandaro-send-followup/index.ts:66 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: brandaro_job_failures,brandaro_message_log — rows 90d: 0 (none-90d)
- dependencies: ok

### `brandaro-send-followup`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: YES | webhook: none | called-by-fn: supabase/functions/brandaro-pipeline-automator/index.ts:188;supabase/functions/brandaro-pipeline-automator/index.ts:250 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: brandaro_job_failures,brandaro_message_log — rows 90d: 0 (none-90d)
- dependencies: ok

### `brandaro-send-followups`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: YES | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;calls:brandaro-create-payment-link
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

### `brandaro-sms-dispatch`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/brandaro/BrandaroActivationCenter.tsx:111 | cron: none | webhook: none | called-by-fn: supabase/functions/comms-feature-prober/index.ts:54 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: brandaro_message_log — rows 90d: 0 (none-90d)
- dependencies: ok

### `brandaro-stripe-webhook`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: Stripe | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;calls:brandaro-pipeline-automator,brandaro-post-payment
- log tables: brandaro_call_patterns,brandaro_job_failures — rows 90d: 0 (none-90d)
- dependencies: ok

## G8-ambassador-ut-sms
### `ambassador-approve-sms`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: none | called-by-fn: supabase/functions/comms-feature-prober/index.ts:52 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

### `ambassador-notify`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/os/unforgettable/UTAmbassadorManagement.tsx:190;src/pages/os/unforgettable/UTAmbassadorManagement.tsx:240 | cron: none | webhook: none | called-by-fn: supabase/functions/comms-feature-prober/index.ts:53;supabase/functions/generate-ut-ambassador-insights/index.ts:137 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

### `ambassador-sale-webhook`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: external-POST | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: ambassador_sales — rows 90d: -1 (none-90d)
- dependencies: MISSING:ambassador_sales

### `ambassador-send-sms`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/hooks/useAmbassadorComms.ts:247 | cron: none | webhook: none | called-by-fn: supabase/functions/comms-feature-prober/index.ts:51 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: ambassador_activity_log,communication_logs,communication_messages — rows 90d: 1431 (recent)
- dependencies: ok

### `ut-ambassador-finder`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/os/unforgettable/UTAmbassadorFinder.tsx:56 | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

### `ut-growth-engine`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/os/unforgettable/UTGrowthEngine.tsx:84;src/pages/os/unforgettable/UTCustomerAcquisition.tsx:72 | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: ut_outreach_log — rows 90d: 0 (none-90d)
- dependencies: ok

### `ut-send-booking-confirmation`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: none | called-by-fn: supabase/functions/ut-stripe-webhook/index.ts:35 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: NOT-LOGGED — rows 90d: 0 (none-90d)
- dependencies: ok

## G9-sbo-sms
### `sbo-daily-automation`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/components/sbo/ChingWorldPicksSMS.tsx:254 | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;calls:get-todays-games,sbo-analyze-tonight,sbo-compare-odds,sbo-consensus-engine,sbo-ingest-book-props,sbo-recalibrate,sbo-run-analysis,sbo-send-daily-email,sbo-sync-polymarket,sbo-top-plays,sbo-verify-results
- log tables: sbo_automation_log,sbo_sms_sends_log — rows 90d: 64 (recent)
- dependencies: ok

### `sbo-send-daily-sms`
- disposition: **GATE-NOW** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/pages/sports-betting/SportsBettingOS.tsx:3605;src/components/sbo/SyncDashboard.tsx:92 | cron: none | webhook: none | called-by-fn: supabase/functions/sbo-day-engine/index.ts:22;supabase/functions/sbo-day-engine/index.ts:45 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms;calls:sbo-generate-daily-briefing
- log tables: sbo_sms_log — rows 90d: 87 (recent)
- dependencies: ok

### `sbo-send-picks-sms`
- disposition: **GATE-LATER** | provider: twilio-direct | gate today: NO-GATE
- trigger — ui: src/components/sbo/ChingWorldPicksSMS.tsx:292 | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: sbo_sms_sends_log — rows 90d: 0 (none-90d)
- dependencies: ok

## ZZ-other
### `dc-bland-dispatch`
- disposition: **ALREADY-GATED** | provider: bland | gate today: Y
- trigger — ui: src/pages/dynasty-connect/DCCallDispatch.tsx:257;src/pages/dynasty-connect/DCCallDispatch.tsx:290 | cron: none | webhook: none | called-by-fn: supabase/functions/bland-agent-webhook/index.ts:420;supabase/functions/_shared/dispatch_gates.ts:7 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: bland;calls:dc-bland-webhook
- log tables: dynasty_ai_calls — rows 90d: 7654 (recent)
- dependencies: ok

### `dd-trigger-bland-campaign`
- disposition: **ALREADY-GATED** | provider: bland | gate today: Y
- trigger — ui: none | cron: none | webhook: none | called-by-fn: supabase/functions/_shared/dc_sync_log.ts:59 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: bland;calls:dc-bland-webhook
- log tables: dc_call_logs,dc_campaigns,dc_leads — rows 90d: 996 (recent)
- dependencies: ok

### `playboxxx-trigger-bland-campaign`
- disposition: **FREEZE** | provider: bland | gate today: NO-GATE
- trigger — ui: none | cron: none | webhook: none | called-by-fn: none | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: bland;calls:dc-bland-webhook
- log tables: dc_campaigns,dc_leads — rows 90d: 996 (recent)
- dependencies: MISSING:playboxxx_leads

### `send-sms`
- disposition: **ALREADY-GATED** | provider: twilio-direct | gate today: Y
- trigger — ui: src/services/templateService.ts:71;src/services/templateService.ts:154 | cron: none | webhook: none | called-by-fn: supabase/functions/admin-notify/index.ts:221;supabase/functions/_shared/dnc.ts:128 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-sms
- log tables: outbound_messages — rows 90d: 822 (recent)
- dependencies: ok

### `tt-trigger-bland-campaign`
- disposition: **ALREADY-GATED** | provider: bland | gate today: Y
- trigger — ui: none | cron: none | webhook: none | called-by-fn: supabase/functions/dd-trigger-bland-campaign/index.ts:6;supabase/functions/tt-create-bland-agent/index.ts:8 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: bland;calls:dc-bland-webhook,gasmask-dnc-write
- log tables: dc_call_logs,dc_campaigns,dc_leads — rows 90d: 996 (recent)
- dependencies: ok

### `twilio-outbound-call`
- disposition: **ALREADY-GATED** | provider: twilio-direct | gate today: Y
- trigger — ui: src/hooks/useUTAIDialer.ts:45;src/components/communication/VoiceGoLiveReport.tsx:254 | cron: none | webhook: none | called-by-fn: supabase/functions/voice-pipeline-audit/index.ts:175;supabase/functions/voice-pipeline-audit/index.ts:191 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: twilio-call;calls:twilio-bridge-to-bland,twilio-call-status,twilio-recording-callback
- log tables: call_recordings — rows 90d: 0 (none-90d)
- dependencies: ok

### `ut-trigger-bland-campaign`
- disposition: **ALREADY-GATED** | provider: bland | gate today: Y
- trigger — ui: src/pages/os/unforgettable/UTOutreachCommand.tsx:440 | cron: none | webhook: none | called-by-fn: supabase/functions/dc-bland-webhook/index.ts:624;supabase/functions/tt-trigger-bland-campaign/index.ts:6 | db-trigger: none | external: [UNKNOWN-MAKE]
- egress: bland;calls:dc-bland-webhook,gasmask-dnc-write
- log tables: dc_campaigns,dc_leads — rows 90d: 996 (recent)
- dependencies: ok
