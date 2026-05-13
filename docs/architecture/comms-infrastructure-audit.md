# Comms Infrastructure Audit

**Status:** Read-only audit. No code or schema changes made.
**Date:** 2026-05-13
**Purpose:** Map every comms-related surface (Twilio, Bland AI, tables, UI, operator infra,
compliance) so the owner can design the operator-customer comms scope from a single source
of truth.

---

## Executive Summary

The Dynasty OS codebase contains **enormous, sprawling comms infrastructure**: 200+
edge functions touching Twilio/Bland, **80+ Postgres tables** for calls/SMS/messaging,
and at least **6 distinct UI hubs** (`/communication`, `/comm-systems`,
`/dynasty-connect`, `/voice-ops`, `/crm/brandaro`, `/va/dashboard`) that overlap
without a single canonical owner.

**Top three findings:**

1. **No single source of truth for "operator → customer" conversations.** There are
   at least 8 thread/message tables (`comm_threads`, `message_threads`,
   `messaging_messages`, `messages`, `universal_messages`, `brandaro_conversations`,
   `ut_supplier_threads`, `ops_inbox_threads`) — each tied to a different brand or
   feature, with no unified inbox.
2. **Phone number ownership is fragmented across 5 tables** (`business_phone_numbers`,
   `brandaro_phone_numbers`, `dc_phone_numbers`, `dynasty_phone_numbers`,
   `voice_ops_number_assignments`). No table currently models "this number belongs to
   operator X for purpose Y" cleanly. Operator-per-number mapping exists only inside
   Brandaro (`brandaro_phone_numbers`).
3. **Twilio + Bland AI are both deeply wired in but with overlapping responsibilities.**
   Twilio handles raw voice/SMS plus TwiML bridges; Bland AI handles AI-driven
   conversations. Multiple bridge functions (`twilio-bridge`,
   `twilio-bridge-to-bland`, `twilio-bridge-fallback`) exist for handoff, and the
   compliance/recording pipeline assumes Twilio-only.

The platform can technically already do operator-customer SMS + calls today
(VA dashboard + Brandaro + DC). What is missing is **conventions and policy**:
who owns a thread, who can read it, which provider wins, when AI takes over,
which number sends from where.

---

## Area 1 — Twilio Integration Map

### Edge functions that call Twilio directly (representative sample, 50+ total)

| Function | Purpose |
|---|---|
| `twilio-voice-twiml`, `twilio-voice-token` | Voice SDK + TwiML for browser dialer |
| `twilio-inbound-call`, `twilio-outbound-call`, `twilio-manual-call` | Call placement |
| `twilio-bridge`, `twilio-bridge-fallback`, `twilio-bridge-to-bland` | Live call bridging incl. AI handoff |
| `twilio-recording-callback`, `start-call-recording`, `play-twilio-recording` | Recording lifecycle |
| `twilio-sms-status`, `twilio-status-webhook`, `twilio-call-status`, `twilio-call-events` | Status webhooks |
| `twilio-gather-webhook`, `twilio-transfer-choice-webhook`, `twilio-human-call-complete`, `twilio-human-queue-hold` | IVR / queue control |
| `twilio-campaign-twiml`, `twilio-campaign-confirm` | Campaign cold-calling |
| `send-sms`, `send-biztext-sms`, `relay-sms`, `bland-send-sms`, `brandaro-sms-dispatch`, `sbo-send-daily-sms`, `sbo-send-picks-sms`, `send-approval-sms` | Outbound SMS (multiple paths) |
| `sms-inbound-webhook`, `sbo-inbound-sms`, `gasmask-sms-inbound`, `brandaro-handle-inbound`, `process-incoming-message`, `supplier-reply-webhook` | Inbound SMS routing |
| `validate-twilio-credentials`, `check-twilio-health`, `voice-pipeline-audit`, `voice-token-selftest`, `discover-twiml-apps` | Health/diagnostics |
| `fetch-twilio-conversation`, `fetch-twilio-messages` | Backfill / sync |

### Shared helpers

- `supabase/functions/_shared/dialer.ts` — Twilio signature validation
  (`validateTwilioSignature`), webhook dedup (`dialer_webhook_events`),
  CORS/XML headers, structured logging.
- `supabase/functions/_shared/bland.ts` — Bland AI dispatcher
  (`placeBlandCall`).

### Twilio credentials & numbers

- Credentials: stored as Supabase secrets (Account SID, Auth Token, API Key, etc.).
  Validated via `validate-twilio-credentials`.
- Numbers tracked in **5 different tables** (see Area 5).
- One health row exists in `business_phone_numbers` (1 record). 22 numbers in
  `dc_phone_numbers`, 16 in `dynasty_phone_numbers`, 6 in `brandaro_phone_numbers`.
- `comm_provider_settings` (provider preference per business) has **0 rows** — feature
  scaffolded but unused.

---

## Area 2 — Bland AI Integration Map

### Functions

| Function | Purpose |
|---|---|
| `bland-start-call`, `bland-agent-trigger` | Place AI calls (with/without persistent agent) |
| `bland-send-sms` | SMS via Bland (rare path; most SMS goes Twilio) |
| `bland-webhook`, `bland-agent-webhook` | Bland post-call + agent webhooks |
| `sync-bland-call` | Pull Bland call results into our DB |
| `dc-bland-dispatch`, `dc-bland-webhook`, `dc-amd-callback` | Dynasty Connect Bland flows |
| `brandaro-ai-caller`, `brandaro-execute-calls`, `brandaro-call-twiml`, `brandaro-call-status` | Brandaro AI calling |
| `tt-auto-dispatch`, `tt-smart-dispatch` | TopTier smart dispatch (uses Bland for AI ring) |
| `gasmask-ai-caller`, `solar-call-initiate` | Brand-specific AI callers |

### Bland-specific tables

- `bland_call_logs` — call history
- `bland_sms_log` — Bland-sent SMS
- `bland_leads` — leads currently tracked by Bland flows
- `bland_agent_webhooks` — webhook event log

### Routing convention (today)

There is **no single router**. Each brand owns its own decision (Brandaro, DC, TT,
Solar, GasMask). Common pattern:

```text
trigger → place-outbound-call OR governed-outbound-call OR brand-specific function
       → if AI:    bland-start-call (uses Bland number/agent)
       → if human: twilio-outbound-call (uses Twilio number, opens browser dialer)
       → on completion: webhook → unified call log table
```

`outbound-call-authority` and `governed-outbound-call` look like the closest thing
to a policy gate, but they are not used everywhere.

---

## Area 3 — Comms Tables (Schema Documentation)

The `public` schema has **80+ comms-related tables**. Grouped by responsibility:

### Threads / conversations (8 overlapping tables)

| Table | Owner | Notes |
|---|---|---|
| `comm_threads` | Generic, **0 rows** — defines `entity_type`, `entity_id`, `primary_phone`, `last_message_at`, `last_provider`. Looks intended as the canonical thread table but never adopted. |
| `message_threads` | Used by in-app messaging (`MessagingInbox`) |
| `messaging_messages` | Messages for `message_threads` |
| `messages` | Generic messages (multiple consumers) |
| `universal_messages` | Cross-brand attempt at unification |
| `brandaro_conversations` | Brandaro-specific |
| `ut_supplier_threads` + `ut_supplier_messages` | Unforgettable Times supplier conversations |
| `ops_inbox_threads` + `ops_inbox_messages` + `ops_inbox_recipients` | Ops back-office inbox |

### Inbound / outbound SMS

- `bland_sms_log`, `va_sms_logs`, `sbo_sms_log`, `sbo_sms_recipients`,
  `sbo_sms_sends_log`, `sms_test_logs`
- `outbound_messages`, `brandaro_message_log`, `brandaro_inbound_messages`,
  `brandaro_pending_messages`
- `outreach_sms`
- `unmatched_messages` — orphaned inbound SMS we couldn't route
- `message_send_queue` + `message_send_queue_items` — pending outbound work
- `message_language_detection` — language tagging

### Calls (40+ tables)

- Core: `call_logs`, `live_calls`, `live_call_sessions`, `live_call_transcripts`,
  `call_recordings`, `call_participants`, `call_outcomes`, `call_dispositions`
- Brandaro family: `brandaro_calls`, `brandaro_ai_calls`, `brandaro_call_logs`,
  `brandaro_call_queue`, `brandaro_call_transcripts`, `brandaro_call_outcomes`,
  `brandaro_call_insights`, `brandaro_call_patterns`, `brandaro_callbacks`,
  `brandaro_post_call_workflows`, `brandaro_unified_call_history`,
  `brandaro_voice_agent_calls`, `brandaro_va_call_sessions`,
  `brandaro_va_call_notes`, `brandaro_va_ai_recommendations`
- AI-call governance: `ai_call_*` (8 tables), `call_ai_*` decisions/predictions
- Dispatch / dialer: `dialer_call_attempts`, `dialer_call_events`,
  `dialer_webhook_events`, `outbound_call_queue`, `campaign_call_frames`,
  `campaign_call_queue`
- DC / Dynasty / VA / DSN: `dc_call_logs`, `dynasty_call_*`, `va_call_logs`,
  `dsn_call_logs`
- TopTier: `tt_dispatches`, `tt_dispatch_requests`
- Other: `solar_call_*`, `cold_call_*`, `manual_call_logs`, `outreach_calls`,
  `human_agent_call_queue`, `human_escalation_inbox`

### Phone numbers (5 tables)

| Table | Rows | Owner |
|---|---|---|
| `business_phone_numbers` | 1 | Generic per-business numbers (rate-limit aware) |
| `brandaro_phone_numbers` | 6 | Per-VA Brandaro numbers (`brandaro_number_pool`, `brandaro_number_sessions`, `brandaro_number_alerts`) |
| `dc_phone_numbers` | 22 | Dynasty Connect outbound |
| `dynasty_phone_numbers` | 16 | Generic Dynasty pool |
| `voice_ops_number_assignments` | 1 | Voice-Ops assignment layer |

### Provider config

- `comm_provider_settings` — per-business default (Twilio vs BizText). **0 rows.**
- `comm_provider_audit_log` — provider switches
- `voice_provider_settings`, `voice_matrix`, `voice_personas`, `voice_profiles`

### Compliance / governance

- `communication_compliance_logs`, `call_disclosure_log`, `call_escalation_log`,
  `call_escalation_rules`, `dispatch_interventions`
- `call_ai_kill_switch`, `call_ai_canary_gate`, `call_ai_authorize_live`,
  `call_ai_audit_proof`, `call_ai_trust_evaluator`
- `test_call_rate_limits`, `test_call_whitelist`

### Drafts / approvals (DRAFT-FIRST law)

- `communication_drafts`, `communication_sent_log` (immutable),
  `communication_messages` (30 rows), `communication_events`,
  `communication_delivery_status`, `communication_escalations`,
  `communication_alerts`
- Templates: `communication_templates`, `communication_playbooks`,
  `communication_sequences`, `va_voicemail_templates`
- `automation_communication_settings`, `ai_communication_queue`

### Recording / transcription

- `call_recordings`, `live_call_transcripts`, `voicemails`,
  `brandaro_call_transcripts`, `dynasty_call_transcripts`,
  `voice_recordings`, `store_voice_notes`

---

## Area 4 — UI Surfaces Audit

Six distinct comms hubs exist. Each is partially complete; none is canonical.

### `/communication/*` (canonical-ish hub)

`src/components/layout/communicationNavigation.ts` registers 13 sub-routes:
Overview, Campaigns, Outbound Growth, Executive AI, Calls, SMS, Email, AI Agents,
Phone Numbers, Caller IDs & Routing, All Logs, Analytics, Settings.

Pages live in `src/pages/communication/` (~25 top-level pages plus subfolders for
agents, ai, call-intelligence, callflows, callreasons, campaigns, cold-calls,
deals, dialer, engagement, escalations, followups, heatmap, inbox, language, live,
manual, messaging, outreach, personas, playbooks, predictions, routing, settings,
voice, voicematrix). Almost every aspect of the system has a page here.

### `/comm-systems/*`

Pages: `CommSystemsLayout`, `CompliancePage`, `QueueDashboardPage`,
`TemplatesPage`, plus subfolders for `ai-agents`, `analytics`, `call-logs`,
`dialer`, `emails`, `hub`, `messages`. Smaller, newer-looking surface.

### `/dynasty-connect/*`

19 pages covering DC's own dialer, agents, campaigns, phone numbers, infrastructure,
intelligence, live calls, lead pipeline, etc. Has its own `dc_*` tables.

### `/voice-ops/*`

5 pages: `VODashboard`, `VONumbers`, `VOOutbound`, `VOSecrets`, `VOAgents`.
Tied to `voice_ops_number_assignments`.

### `/crm/brandaro/*`

VA-facing comms surface for Brandaro Digital — invoice intake, AI calling,
conversations, inbox, VA performance.

### `/va/dashboard`

Operator (VA) cockpit. Features `VAAutoDialerSection` (which embeds
`CampaignDialPage` to share logic), `VACallPanel`, `VAPowerDialer`,
`VARecentCalls`, `VACallHistory`, `BrandaroLeadIntakeModal`,
`SecureClientIntakeForm`, plus the new sidebar tab for intake.

### Cross-cutting components

- `src/components/communication/CallProvider.tsx` + `CallContext.ts` — global
  call HUD context
- `SystemHealthBar`, `VoiceInfrastructureAudit`, `VoiceGoLiveReport`,
  `TwilioCredentialInstaller`, `BlandAgentWebhookDirectory`
- `MessagingInbox`, `ChatWindow` (`src/pages/Messages.tsx` consumer)

---

## Area 5 — Operator Infrastructure Audit

### Operator identity

Operators today are modeled as `auth.users` rows with `user_roles` (role enum
includes `va`, `csr`, `admin`, `owner`, `driver`, `biker`, `ambassador`,
`employee`, `wholesaler`, etc.). Brandaro VAs additionally exist in a
Brandaro-specific layer (sessions tracked in `brandaro_number_sessions`).

### Operator → number mapping

- **Brandaro (only well-defined model):** `brandaro_phone_numbers` ties a Twilio
  number to a VA. `brandaro_number_pool` allocates pool numbers.
  `brandaro_number_sessions` records active sessions. `brandaro_number_alerts`
  flags problems.
- **Voice-Ops:** `voice_ops_number_assignments` (1 row) is the closest generic
  mapping but unused.
- **Dynasty Connect / Dynasty / TopTier / GasMask / Solar** all have their own
  number tables but **none directly tie a number to an operator** — they tie to a
  campaign or business.

### Operator → conversation mapping

There is no canonical "operator owns thread" link today. Threads are typically
tied to a contact/store/lead, and operator presence is inferred from message
sender (`sent_by`, `created_by`).

`comm_threads.entity_type` + `entity_id` is the only generic anchor pattern, but
it's empty.

### Operator dialer surfaces

- `VAAutoDialerSection` (embeds `CampaignDialPage`) — Twilio + Bland combined
- `VAPowerDialer`, `VACallPanel` — manual operator dialer
- `dialer-bridge-agent`, `dispatch-campaign-tick` — backend dispatcher
- Recover-stuck control: `dialer_stuck_call_sweep` RPC + `recover_stale_calls`

### Operator AI assistants

- `va-trainer-ai`, `va-evaluator-ai`, `va-task-router-ai`, `va-live-coach`,
  `va-post-call-analysis`, `va-analyze-call`, `analyze-va-call`
- `ai-message-composer`, `ai-generate-message`, `sms-writer`,
  `communication-ai`, `communication-brain`, `communication-insights`
- All bound by `AI_COMMUNICATION_RULES` (see `src/lib/ai-communication-rules.ts`):
  AI may **only** create drafts; humans must approve before send.

---

## Area 6 — Compliance Considerations

### Existing compliance scaffolding

- **Draft-first law** (`AI_COMMUNICATION_RULES`): AI cannot send or schedule.
  Every AI output is a `communication_drafts` row, requires human approval,
  immutable audit row in `communication_sent_log`.
- **Recording disclosure:** `call-disclosure-handler` + `call_disclosure_log`.
- **Opt-out:** `check_opt_out_before_call` RPC, `prevent_outbound_delete`
  trigger, `can_send_messages` RPC.
- **Twilio signature validation:** enforced for every Twilio webhook via
  `validateTwilioSignature` in `_shared/dialer.ts`. Webhook dedup via
  `dialer_webhook_events`.
- **Bland webhook secret:** validated in `_shared/dialer.ts`.
- **Compliance UI:** `src/pages/comm-systems/CompliancePage.tsx` →
  `ComplianceCenter` ("opt-ins, consents, data retention").
- **Rate limiting:** `business_phone_numbers.max_calls_per_minute` /
  `max_sms_per_minute`. Test environment uses `test_call_rate_limits` +
  `test_call_whitelist`.
- **AI safety net:** `call_ai_kill_switch`, `call_ai_canary_gate`,
  `call_ai_auto_downgrade`, `call_ai_trust_evaluator`,
  `call_ai_authorize_live`, `call-ai-audit-proof`,
  `call-ai-audit-export`.

### Gaps observed

- **No documented SMS opt-in capture flow** for net-new contacts (the
  `ComplianceCenter` UI exists but the ingest path for STOP/HELP keywords from
  multiple inbound SMS functions is not unified).
- **Recording 2-party consent** is enforced only by disclosure handler — there
  is no per-state policy table.
- **Cross-brand opt-out** (does opt-out from Brandaro propagate to TopTier?)
  is unclear.
- **Operator ↔ customer thread visibility** has no RLS-enforced policy yet
  (`comm_threads` is empty so no policies exist in production).
- **Data retention** for transcripts, recordings, and SMS logs is undefined —
  no scheduled deletion/redaction.

---

## Open Questions for Owner

These must be answered before designing the operator-customer comms scope.

1. **Number ownership model.** Per-operator dedicated Twilio numbers (Brandaro
   pattern) **OR** shared pool with smart routing (DC pattern) **OR** hybrid?
   Today both exist; pick one default.
2. **Thread ownership semantics.** Should a conversation be keyed by:
   `(customer)`, `(customer, operator)`, `(customer, brand)`, or
   `(customer, brand, operator)`? This decides whether reassigning a customer
   to a new operator splits or carries the thread.
3. **Canonical thread table.** Adopt `comm_threads` (currently empty) and
   migrate the 7 other thread tables, **OR** keep them brand-isolated forever?
   Decision blocks any "unified inbox" work.
4. **Operator visibility into peer threads.** Can operator A see operator B's
   conversations with the same customer? (Manager/admin yes; peer yes/no?)
5. **Provider routing rule.** When does the system pick Twilio vs Bland vs
   BizText for an outbound message? Today every brand decides on its own.
   Should `comm_provider_settings` become the global router?
6. **AI handoff policy.** When does Bland AI take over a live call from a human
   operator (and vice versa)? `twilio-bridge-to-bland` exists but has no
   documented trigger conditions.
7. **Recording policy.** Record all operator-customer calls? Only AI calls?
   Need legal review for 2-party consent states. Where is the master toggle?
8. **Inbound routing.** When a customer texts/calls a number, who gets it?
   Currently inbound routing is per-brand (`brandaro-handle-inbound`,
   `gasmask-sms-inbound`, `sbo-inbound-sms`, etc.). Need a master inbound
   router with fallback to "unmatched_messages".
9. **SMS opt-in/opt-out model.** Single global opt-out per phone, or per-brand?
   How is opt-in captured for net-new leads at intake?
10. **AI auto-send escape valve.** Today AI may **never** send (draft-first).
    Is there any scenario the owner wants to whitelist for true autonomy
    (e.g. delivery confirmations, OTPs)? If yes, define the boundary.
11. **Retention.** How long do we keep transcripts, recordings, and SMS bodies
    before redaction? Are we subject to GDPR/CCPA deletion requests?
12. **Cost control.** Per-operator monthly Twilio + Bland spend cap? Today
    `voice_cost_events` and `call_cost_events` log costs but no enforcement
    layer exists.

---

## What This Audit Does Not Cover

- Cost analysis (Twilio + Bland per-message/per-minute pricing model)
- Email infrastructure (Resend / SendGrid / etc.) — out of scope
- WhatsApp / iMessage — not currently integrated
- A migration plan to consolidate the 8 thread tables — needs owner direction first

---

## Recommendation for Tomorrow's Design Session

Pick answers to questions 1, 2, and 3 first. Those three decisions cascade into
every other comms design choice (RLS policies, dispatcher routing, inbound
router, AI handoff). The other questions can be answered once that foundation
is set.
