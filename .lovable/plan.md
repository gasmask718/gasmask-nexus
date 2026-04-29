# Auto-Dialer + Bland AI: Production-Grade Call Flow Rebuild

## Current state (verified)

- Page `/communication/auto-dialer` → Campaigns tab → `CampaignWizardPage.tsx` dispatcher.
- Today the dispatcher takes a queue item and **calls Bland AI directly** (`bland-agent-trigger` → `https://api.bland.ai/v1/agents/{id}/calls`). Bland uses its own carrier; Twilio is not invoked first, no TTS intro is played, and no DTMF/speech confirmation gates the AI handoff.
- Recording / transcript persistence relies only on Bland's post-call webhook (`bland-agent-webhook`) writing to `bland_call_logs`. There is **no Twilio recording leg**, no live status timeline, and the dashboard's "Live Calls" stat just counts queue rows in `dialing`/`connected` states.
- Existing reusable infra: `twilio-outbound-call`, `twilio-voice-twiml`, `twilio-gather-webhook`, `twilio-status-webhook`, `twilio-recording-callback`, `twilio-transfer-choice-webhook`, `dialer-bridge-agent`, plus tables `outbound_call_queue`, `dialer_campaigns`, `bland_leads`, `bland_call_logs`, `bland_agent_webhooks`, `live_call_transcripts`, `call_recordings`.

## Target call lifecycle

```text
Campaign launched
        │
        ▼
Dispatcher picks queue row → status=dialing
        │
        ▼
Twilio outbound call placed (record=true, dual_channel)
   • answer_url → /twilio-campaign-twiml  (TTS the campaign script)
   • status_callback → /twilio-status-webhook
   • recording_callback → /twilio-recording-callback
        │
        ▼
Recipient answers → Twilio plays <Say> script
        │
        ▼
<Gather input="dtmf speech" timeout=6 numDigits=1
        speechTimeout="auto" hints="yes,sure,okay,one">
   Press 1 (or say "yes") to speak with our specialist…
        │
   ┌────┴────┐
   │         │
 Confirmed   No / invalid / timeout
   │         │
   ▼         ▼
Transfer    Retry prompt once → polite goodbye → hangup
to Bland    queue row status=declined / no_input
   │
   ▼
/twilio-bridge-to-bland generates TwiML <Dial><Number>
that calls a Bland phone or initiates a Bland call_id
seamlessly (recording continues; statusCallback retained)
   │
   ▼
Bland AI agent takes over the conversation
   │
   ▼
Bland posts post-call webhook → bland-agent-webhook
   • Writes transcript + recording_url to bland_call_logs
   • Updates lead status from outcome
Twilio status webhook → marks queue row completed/failed
Twilio recording webhook → stores raw audio in call_recordings
```

## Workstreams

### 1. New Twilio-first dispatcher

- **Edit `bland-agent-trigger`** (or add new `campaign-dial-start`): instead of POSTing to Bland, place an outbound Twilio call via the gateway with:
  - `Url` = `…/twilio-campaign-twiml?queue_item_id=…&campaign_id=…`
  - `StatusCallback` = `…/twilio-status-webhook` (events: initiated, ringing, answered, completed)
  - `Record=true`, `RecordingChannels=dual`, `RecordingStatusCallback=…/twilio-recording-callback`
  - `MachineDetection=Enable` for AMD when campaign opts in
- Persist `twilio_call_sid` on the queue row immediately for live tracking.

### 2. New edge function `twilio-campaign-twiml`

- Public TwiML endpoint. Loads campaign by id, returns:
  - `<Say voice="Polly.Joanna">{initial_script}</Say>`
  - `<Gather input="dtmf speech" numDigits="1" timeout="6" speechTimeout="auto" hints="yes,sure,okay,interested,one" action="…/twilio-campaign-confirm?queue_item_id=…&campaign_id=…" method="POST">`
    - inner `<Say>` confirmation prompt
  - Fallback `<Say>` + `<Hangup/>` if no input.

### 3. New edge function `twilio-campaign-confirm`

- Receives Twilio's Gather POST (`Digits`, `SpeechResult`, `Confidence`).
- Decision logic:
  - Digit `1` OR speech intent ∈ {yes, sure, okay, yeah, interested, please} → return TwiML that invokes `twilio-bridge-to-bland`.
  - Digit `2`/no/negative → polite `<Say>` + `<Hangup/>`, mark queue row `declined`.
  - Empty / low confidence → re-prompt once via re-`<Gather>`; second miss → `no_input` + hangup.
- Logs each decision into `live_call_transcripts` (speaker `system`) for the dashboard timeline.

### 4. New edge function `twilio-bridge-to-bland`

Two supported modes (campaign-configurable, default mode A):

- **Mode A — Bland inbound number (recommended, zero-drop):**
  - Returns TwiML `<Dial record="record-from-answer-dual" recordingStatusCallback="…/twilio-recording-callback"><Number statusCallbackEvent="answered completed" sendDigits="…">{BLAND_INBOUND_NUMBER}</Number></Dial>`
  - Bland answers with the configured agent. Continuous recording + same Twilio call leg = no perceptible drop.
  - Requires one new secret: `BLAND_INBOUND_NUMBER` (Bland-provisioned DID tied to the right agent). We'll request it via `add_secret` before deploying.
- **Mode B — Bland API outbound (fallback):**
  - Calls `https://api.bland.ai/v1/agents/{bland_agent_id}/calls` with the **same** recipient number, plays a brief `<Say>"Connecting you now…"</Say>` then `<Hangup/>` on the Twilio leg. Used only if Mode A unavailable. Notes the gap clearly in logs.

### 5. Recording + transcription wiring

- Twilio side: ensure `twilio-recording-callback` upserts into `call_recordings` keyed by `provider_call_sid`, links to the queue row, and stores `recording_url`.
- Bland side: keep `bland-agent-webhook`. Extend it to:
  - Look up the queue row by `metadata.queue_item_id` and write `bland_call_id`, `transcript`, `recording_url` to `outbound_call_queue` (new columns) and to `bland_call_logs`.
  - Write per-utterance lines into `live_call_transcripts` for unified display.
- Twilio's `<Gather>` speech intent + system events also go into `live_call_transcripts` so the Campaigns tab transcript panel shows the full timeline (intro → confirmation → AI conversation).

### 6. Status timeline (real-time dashboard)

- `twilio-status-webhook` maps Twilio call events → `outbound_call_queue.status`:
  - `initiated`/`ringing` → `dialing`
  - `in-progress` → `connected`
  - `completed` (post-bridge) → `transferred` if Bland confirmed engagement, else `completed`
  - `busy`/`failed`/`no-answer` → corresponding queue states
- Append rows to a new lightweight log table `dialer_call_events` (call_sid, event, payload, ts) so the Live Monitor can render a true status timeline. Table created via migration with RLS scoped to `business_id`.

### 7. Campaigns tab UI fixes

In `CampaignWizardPage.tsx`:

- **Live Monitor card**: subscribe via Supabase Realtime to `outbound_call_queue` and `dialer_call_events` filtered by `campaign_id`. Render columns: contact, status badge (animated for `dialing`/`ringing`/`connected`/`bridged`), elapsed timer, current step (Intro / Awaiting confirm / Bridged to AI / Wrap-up).
- **Active engagement counter** = Twilio sids in `connected` or `bridged` state (not just queue rows).
- **Logs tab**: render unified timeline per call using `dialer_call_events` + `live_call_transcripts` + Bland transcript. Show DTMF / speech captured, transfer event, and any errors with raw Twilio/Bland error codes (zero silent failures rule).
- **Recording column**: link Twilio `recording_url` AND Bland `recording_url` separately when both exist.
- Fix the existing transcript fetch (currently keyed only on Twilio sids) to also union Bland transcripts via `bland_call_logs.lead_id`.

### 8. Reliability + fallbacks

- Retry policy on queue row: `max_attempts` honored on Twilio failure (`failed`, `no-answer`, `busy`) using `next_retry_at = now() + retry_backoff_minutes`.
- Idempotency: `twilio-campaign-confirm` and webhooks key on `CallSid`; duplicate Twilio retries don't double-bridge.
- Concurrency cap: dispatcher respects `max_concurrent_calls` per campaign by counting `dialing|connected|bridged` queue rows before placing the next call.
- Auth: webhooks remain public (Twilio/Bland post unauthenticated) but validate Twilio signatures using `TWILIO_AUTH_TOKEN` and Bland via shared secret in metadata.

### 9. Database changes (single migration)

- `outbound_call_queue`: add `bland_call_id text`, `bland_recording_url text`, `bland_transcript text`, `confirmation_method text`, `confirmation_value text`, `bridged_at timestamptz`, `ended_at timestamptz`. Extend allowed `status` values via trigger (no CHECK constraint per project rule): `declined`, `no_input`, `bridged`, `transferred`.
- New table `dialer_call_events` (id, business_id, campaign_id, queue_item_id, call_sid, event_type, payload jsonb, created_at) with RLS by business and a composite index on (campaign_id, created_at desc). Added to `supabase_realtime` publication.
- `dialer_campaigns`: add `bridge_mode text default 'bland_did'` (`bland_did` | `bland_api`), `confirmation_prompt text`, `confirmation_retries int default 1`.

### 10. Secrets / config

- Already present: `BLAND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, agent IDs.
- **Need to add** (will request via `add_secret` before deploying Mode A):
  - `BLAND_INBOUND_NUMBER` — Bland-provisioned DID that routes to the desired campaign agent.
- `supabase/config.toml`: declare the new public webhooks (`twilio-campaign-twiml`, `twilio-campaign-confirm`, `twilio-bridge-to-bland`) with `verify_jwt = false` so Twilio can hit them.

### 11. Verification checklist (post-build)

- Place a test call to a real number from the Campaigns tab; confirm: TTS intro plays → DTMF `1` confirmation → audible bridge to Bland agent without drop → recording downloadable → transcript visible in dashboard within ~5s of hangup.
- Negative path: press `2` → polite goodbye, queue row `declined`, no Bland call started.
- Timeout path: stay silent → reprompt → silence → `no_input`, hangup, retry scheduled per `max_attempts`.
- Realtime: open the dashboard in two windows and confirm status badges update live without manual refresh.

## Out of scope

- Replacing ElevenLabs in any other surface (Brandaro VA, DC, etc.).
- Changing the manual (human) dial mode — that path keeps using `twilio-manual-call` unchanged.
- Migrating historical Bland calls into the new event timeline.
