
# Fix AI Agent + Twilio Call Integration

## Problem
Right now, clicking "Call" on the AI Agents page does two completely disconnected things:
1. Places a Twilio phone call to the store -- but the call just says "Connecting your call now" and has nobody on the other end
2. Opens a browser-based ElevenLabs voice dialog -- which is a separate mic/speaker session in your browser

The AI agent is never actually on the phone call. The store hears silence, and no audio flows between them.

## Solution
Use ElevenLabs' **Register Call API** to connect the AI agent directly to the Twilio phone call. When Twilio answers, instead of playing a generic message, the call will be routed through a WebSocket to the ElevenLabs AI agent -- so the store actually talks to the AI on the phone.

## How It Will Work (New Flow)

```text
User clicks "Call" on store
        |
        v
[place-outbound-call edge function]
        |
        v
Twilio dials the store's phone
  - Webhook URL points to new "twilio-elevenlabs-bridge" edge function
        |
        v
[twilio-elevenlabs-bridge edge function]
  - Twilio hits this URL when the call connects
  - This function calls ElevenLabs Register Call API
  - ElevenLabs returns TwiML with WebSocket connection
  - Returns that TwiML to Twilio
        |
        v
Twilio connects call audio to ElevenLabs AI agent via WebSocket
  - Store hears the AI agent speaking
  - AI agent hears the store's responses
  - Real two-way phone conversation
```

## Changes

### 1. New Edge Function: `twilio-elevenlabs-bridge`
A new backend function that serves as the webhook Twilio calls when the outbound call connects. It:
- Receives the call details (From, To numbers) from Twilio
- Calls `POST https://api.elevenlabs.io/v1/convai/twilio/register-call` with the agent ID, phone numbers, and direction "outbound"
- Returns the TwiML from ElevenLabs directly to Twilio
- This TwiML instructs Twilio to stream the call audio over WebSocket to ElevenLabs

### 2. Modify `place-outbound-call` Edge Function
Change the TwiML URL so that instead of using the simple "Connecting your call now" message, it points to the new `twilio-elevenlabs-bridge` function. The agent ID will be passed as a query parameter so the bridge knows which AI agent to connect.

### 3. Update Frontend (`AIAgentsPanel.tsx`)
Pass the `elevenlabs_agent_id` to the `placeCallNow` call so the backend knows which ElevenLabs agent to connect to the phone call.

### 4. Remove Browser Voice Dialog
Since the AI agent will now be on the actual phone call (not in the browser), the `VoiceCallDialog` browser session is no longer needed for this flow. The user just initiates the call and the AI handles the conversation on the phone.

## Technical Details

**New file: `supabase/functions/twilio-elevenlabs-bridge/index.ts`**
- Handles POST from Twilio (form-encoded body with `From`, `To`, `CallSid`, etc.)
- Extracts `agent_id` from query parameters
- Calls ElevenLabs Register Call API:
  ```
  POST https://api.elevenlabs.io/v1/convai/twilio/register-call
  Headers: { "xi-api-key": ELEVENLABS_API_KEY }
  Body: { agent_id, from_number, to_number, direction: "outbound" }
  ```
- Returns the TwiML response (XML) directly to Twilio
- Must set `verify_jwt = false` in config.toml (Twilio calls this URL directly)

**Modified file: `supabase/functions/place-outbound-call/index.ts`**
- Accept optional `agent_id` parameter in the request body
- Change the TwiML URL from the simple echo service to the bridge function URL:
  ```
  https://{projectId}.supabase.co/functions/v1/twilio-elevenlabs-bridge?agent_id={agentId}
  ```
- When no `agent_id` is provided, keep the current simple TwiML behavior (so non-AI calls still work)

**Modified file: `src/components/communication/AIAgentsPanel.tsx`**
- Pass `agent_id` in the call parameters (via `notes` or a new field) so the backend connects the right AI agent
- Simplify the post-call UI since the AI conversation happens on the phone, not in the browser

**Modified file: `src/hooks/useOutboundCall.ts`**
- Add optional `agent_id` field to `PlaceCallParams`
- Pass it through to the edge function

**Config: `supabase/config.toml`**
- Add `[functions.twilio-elevenlabs-bridge]` with `verify_jwt = false`

## Prerequisites
- The ElevenLabs agent must be configured with **u-law 8000 Hz** audio format (both TTS output and input) in the ElevenLabs dashboard for telephony compatibility
- The `ELEVENLABS_API_KEY` secret is already configured
