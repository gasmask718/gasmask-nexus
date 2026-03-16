

# Call Transfer Feature for Manual Campaign Modal

## Overview
Add a "Transfer" button to the manual cold call modal that lets you hand off the active call to either an **ElevenLabs AI agent** or a **Google Voice human agent**. After transfer, you're freed to dial the next number immediately. Transferred call transcripts continue recording even after you disconnect.

## Flow
```text
Dial contact → Talk → Transfer (pick target) → Call moves to target
  ↓                                                ↓
You're free to dial next number          Transcript continues recording
  ↓                                      via Twilio recording + status hooks
Cycle repeats until campaign done
```

## Changes

### 1. New Edge Function: `transfer-campaign-call`
- Accepts: `call_sid`, `transfer_type` ("elevenlabs" | "human"), `queue_item_id`, `campaign_id`
- **ElevenLabs path**: Redirects the active Twilio call to the existing `twilio-elevenlabs-bridge` endpoint (reuse existing infrastructure)
- **Human agent path**: Redirects the call to a configured Google Voice number using `call-live-handoff` style TwiML with `<Dial><Number>` and `record="record-from-answer-dual"` plus a `recordingStatusCallback` so transcripts are captured server-side
- Updates `outbound_call_queue` status to `"transferred"` with metadata (transfer type, target)
- Inserts a transcript marker: `[TRANSFERRED to {target}]` into `live_call_transcripts`

### 2. Update `ManualCampaignCallModal.tsx`
- **New state**: `showTransferPicker` (boolean), `isTransferring` (boolean)
- **Transfer button** in call controls (alongside Mute/End): opens a small picker dialog with two options:
  - "AI Agent (ElevenLabs)" — icon + description
  - "Human Agent (Google Voice)" — icon + description
- **Transfer action**:
  1. Invoke `transfer-campaign-call` edge function with the active `callSid`
  2. On success: disconnect local Twilio call leg (hang up browser side), clear `isOnCall` state
  3. Mark queue item as `"transferred"` (not `"completed"` — different status so dashboard can track)
  4. Auto-advance to next queued number (same logic as `skipToNext` but without marking as no_answer)
  5. User can immediately dial the next number
- **Update `isOnCall` check**: Add `"transferred"` to terminal states so the modal unlocks after transfer
- **Update `handleTerminal`**: Also handle `"transferred"` status
- Transcripts from the transferred call continue flowing into `live_call_transcripts` via Twilio's recording callbacks — these are already wired in `twilio-call-status`

### 3. Transfer Picker UI (inline in modal)
Small popover/dropdown when "Transfer" is clicked:
- Two cards: ElevenLabs Agent | Human Agent (Google #)
- Confirm button
- Shows "Transferring..." state with spinner

### 4. Post-Transfer Transcript Recording
- For **ElevenLabs transfers**: The bridge already registers the call with ElevenLabs which handles transcript capture via their conversation API
- For **human agent transfers**: The `<Dial record="record-from-answer-dual">` in TwiML ensures Twilio records both sides. The existing `twilio-call-status` webhook receives the recording URL and persists it to `call_recordings`
- Both paths insert transcript entries into `live_call_transcripts` with the original `call_sid`, so the campaign dashboard Logs tab picks them up automatically

### 5. Database
- Add `"transferred"` to recognized queue item statuses in the modal's filter/display logic (no schema migration needed — the `status` column is already text type)

## Technical Details
- The transfer uses Twilio's REST API `POST /Calls/{CallSid}.json` with a `Url` parameter pointing to TwiML that either bridges to ElevenLabs or dials the Google number — same pattern as the existing `call-live-handoff` function
- The browser's Twilio call connection is disconnected immediately after the server-side redirect succeeds, freeing the user
- The Google Voice number will be passed as a parameter from the frontend (or stored in campaign settings)

