

# Add Call Transcript Logging for AI Agent Calls

## Overview
After each AI agent call completes, we will fetch the full conversation transcript from ElevenLabs and store it in the database. This lets you verify the agent followed the GASMASK INVENTORY CHECK script and see exactly what was said on both sides.

## How It Works

```text
Call ends (Twilio status = "completed")
        |
        v
[twilio-call-status] detects it was an AI agent call
        |
        v
Calls new [fetch-elevenlabs-transcript] edge function
        |
        v
Fetches transcript from ElevenLabs API:
  GET /v1/convai/conversations/{conversation_id}
        |
        v
Saves transcript to ai_call_logs and manual_call_logs
        |
        v
Viewable in the AI Agents panel UI
```

## Changes

### 1. Capture `conversation_id` from ElevenLabs Register Call response
The `twilio-elevenlabs-bridge` function already calls ElevenLabs Register Call API, which returns `{ twiml, conversation_id }`. We will:
- Extract `conversation_id` from the response
- Store it in `call_recordings.metadata` (or a new column) keyed to the Twilio `CallSid`
- This links every Twilio call to its ElevenLabs conversation

### 2. New Edge Function: `fetch-elevenlabs-transcript`
A backend function that:
- Accepts a `conversation_id`
- Calls `GET https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}` with the ElevenLabs API key
- Returns the structured transcript (array of `{ role, message, time_in_call_secs }`)
- Saves the transcript to the database

### 3. Store the `conversation_id` during the bridge call
The bridge function currently does not have database access. Two approaches:
- **Option A**: Add Supabase client to the bridge and write the `conversation_id` to `call_recordings` directly (matched by `CallSid`)
- **Option B**: Return the `conversation_id` in TwiML custom parameters and have the call-status webhook store it

We will use **Option A** since it is simpler and more reliable.

### 4. Modify `twilio-call-status` to fetch transcript on call completion
When a call reaches "completed" status, the webhook will:
- Check if the call has a stored `conversation_id` in `call_recordings`
- If yes, call the ElevenLabs Conversations API to get the transcript
- Save the formatted transcript to `ai_call_logs.transcription` and/or `manual_call_logs.metadata`

### 5. Add database migration
- Add `elevenlabs_conversation_id` column to `call_recordings` table
- This column links Twilio calls to their ElevenLabs conversation for transcript retrieval

### 6. Add Transcript Viewer in the AI Agents panel
A simple UI component that:
- Shows a list of recent AI agent calls with status
- Clicking a call shows the full transcript in a dialog
- Each message displays the role (Agent vs Customer) and timestamp
- Highlights whether the agent followed the inventory check script steps

## Technical Details

**Modified: `supabase/functions/twilio-elevenlabs-bridge/index.ts`**
- Add Supabase client initialization
- After getting `conversation_id` from ElevenLabs response, write it to `call_recordings` matched by `CallSid`

**New: `supabase/functions/fetch-elevenlabs-transcript/index.ts`**
- Accepts `{ conversation_id }` in POST body
- Calls `GET https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}`
- Returns structured transcript data
- Optionally saves to database

**Modified: `supabase/functions/twilio-call-status/index.ts`**
- On terminal "completed" status, check `call_recordings` for `elevenlabs_conversation_id`
- If found, fetch transcript from ElevenLabs and save to `ai_call_logs`

**New: `src/components/communication/CallTranscriptViewer.tsx`**
- Dialog component showing call transcript
- Role-based message bubbles (Agent left, Customer right)
- Timestamp display for each message

**Modified: `src/components/communication/AIAgentsPanel.tsx`**
- Add a "Recent Calls" section below the store table
- Each row shows store name, date, duration, outcome, and a "View Transcript" button

**Database migration:**
- `ALTER TABLE call_recordings ADD COLUMN elevenlabs_conversation_id TEXT`

