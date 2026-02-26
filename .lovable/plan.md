
# Cold Call Blast & TTS Outbound System

## Overview
Build a new "Cold Call Blast" page under `/communication/cold-call-blast` that enables:
1. **TTS Cold Calls** -- Dial multiple numbers, play an ElevenLabs-generated TTS message, and if the recipient listens fully and shows interest, transfer them to a live agent number
2. **Normal Calls** -- Place standard Twilio outbound calls to multiple numbers with live connect (no AI)

Both modes leverage existing infrastructure: `place-outbound-call`, `twilio-elevenlabs-bridge`, `elevenlabs-tts`, and the `manual_call_logs` / `call_recordings` tables.

---

## What Gets Built

### 1. New Edge Function: `cold-call-tts-blast`
Orchestrates the TTS cold call flow:
- Accepts a list of phone numbers, a TTS message script, a handoff number, and optional ElevenLabs voice/agent config
- For each number: places a Twilio call with a TwiML `<Play>` of pre-generated TTS audio OR routes through the `twilio-elevenlabs-bridge` for conversational AI
- If the call is answered and the message plays fully, uses `<Gather>` to detect interest (e.g., "Press 1 to speak with someone") then `<Dial>` to the handoff number
- Logs each call to `manual_call_logs` and `call_recordings`
- Respects opt-out registry check before dialing
- Rate-limits concurrent calls (max 5 simultaneous)

### 2. New Edge Function: `cold-call-tts-webhook`
Twilio status/gather callback handler:
- Receives Twilio `<Gather>` results (DTMF input or speech)
- If interested (pressed 1 or said "yes"), returns TwiML to `<Dial>` the handoff number
- If not interested or no input, returns `<Say>` goodbye and `<Hangup>`
- Updates `manual_call_logs` with disposition

### 3. New Page: `ColdCallBlastPage.tsx`
Located at `/communication/cold-call-blast` with two tabs:

**Tab 1: TTS Blast**
- Textarea for entering phone numbers (one per line, or comma-separated)
- CSV upload option for bulk numbers
- Text area for the TTS message script
- ElevenLabs voice selector (reuses existing `VoiceProfileSelector`)
- Handoff number input (the live number to transfer interested callers to)
- "Preview TTS" button -- generates audio preview via existing `elevenlabs-tts` edge function
- "Launch Blast" button -- kicks off the campaign
- Live progress table showing each number's status (queued, ringing, answered, transferred, no-answer, failed)
- Real-time updates via database polling

**Tab 2: Normal Calls**
- Same phone number input (textarea + CSV)
- Handoff/destination number
- Simple TwiML: ring the number, connect to handoff
- Uses existing `place-outbound-call` edge function in a loop
- Progress table with status tracking

### 4. Database Table: `cold_call_campaigns`
Tracks each blast campaign:
- `id`, `created_by`, `created_at`
- `campaign_type` (tts_blast | normal_blast)
- `tts_script` (text of the message)
- `voice_id` (ElevenLabs voice)
- `handoff_number`
- `status` (draft, running, paused, completed)
- `total_numbers`, `completed_count`, `transferred_count`

### 5. Database Table: `cold_call_items`
Individual call items within a campaign:
- `id`, `campaign_id` (FK)
- `phone_number`, `status` (queued, dialing, answered, transferred, no_answer, failed, completed)
- `call_sid`, `duration`, `disposition`
- `created_at`, `updated_at`
- Enable realtime on this table for live UI updates

### 6. Route & Navigation Integration
- Add route `/communication/cold-call-blast` in `AppRoutes.tsx`
- Add nav item in `CommunicationHubLayout.tsx` nav list with `Megaphone` icon, labeled "Cold Call Blast"

---

## Technical Details

### TTS Call Flow (Sequence)
```text
User clicks "Launch Blast"
  --> Frontend calls cold-call-tts-blast edge function
    --> For each phone number (batched, max 5 concurrent):
      1. Check opt-out registry
      2. Generate TTS audio via elevenlabs-tts (or use cached)
      3. Place Twilio call with TwiML:
         <Response>
           <Play>{tts_audio_url}</Play>
           <Gather input="dtmf speech" timeout="5" action="{webhook_url}">
             <Say>Press 1 or say yes to speak with a representative.</Say>
           </Gather>
           <Say>Thank you for your time. Goodbye.</Say>
           <Hangup/>
         </Response>
      4. Insert row into cold_call_items
      5. Twilio webhook updates status
```

### Normal Call Flow
```text
User clicks "Launch Blast"
  --> Frontend loops through numbers, calls place-outbound-call for each
  --> Each call uses standard TwiML to connect to handoff number
  --> Status tracked via existing twilio-call-status webhook
```

### Audio Hosting for TTS
The TTS audio needs a publicly accessible URL for Twilio's `<Play>`. The edge function will:
1. Generate audio via ElevenLabs API
2. Store it in a Supabase Storage bucket (`cold-call-audio`)
3. Return the public URL to embed in TwiML

### Security & Compliance
- Opt-out registry check before every dial
- Rate limiting (max calls per hour configurable)
- All calls logged to `manual_call_logs` for audit
- RLS policies on new tables scoped to authenticated users

### Files to Create
- `supabase/functions/cold-call-tts-blast/index.ts`
- `supabase/functions/cold-call-tts-webhook/index.ts`
- `src/pages/communication/cold-calls/ColdCallBlastPage.tsx`
- `src/hooks/useColdCallBlast.ts`
- Migration SQL for `cold_call_campaigns` and `cold_call_items` tables + storage bucket

### Files to Edit
- `src/routes/AppRoutes.tsx` -- add route + import
- `src/pages/communication/CommunicationHubLayout.tsx` -- add nav item
- `supabase/config.toml` -- add `verify_jwt = false` for new edge functions
