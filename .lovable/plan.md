

# ElevenLabs AI Voice Call Integration

## Overview
Add real-time AI voice calling to the `/communication/agents` page. Each AI agent gets a "Call" button that opens a live voice conversation powered by ElevenLabs Conversational AI.

## What You Need to Provide
1. **ElevenLabs Agent ID** -- Create a Conversational AI Agent at [elevenlabs.io/app/conversational-ai](https://elevenlabs.io/app/conversational-ai) and copy the Agent ID
2. **Your script** -- Share it so I can configure the agent prompt (or configure it directly in the ElevenLabs dashboard)
3. **Voice preference** -- Which voice style you want (professional, friendly, etc.)

## Implementation Steps

### Step 1: Store API Key Securely
- Save `ELEVENLABS_API_KEY` as a backend secret (never in code)

### Step 2: Create Backend Function for Token Generation
- New function: `elevenlabs-conversation-token`
- Accepts an `agent_id`, calls ElevenLabs API to generate a secure WebRTC conversation token
- Returns token to the client

### Step 3: Install ElevenLabs React SDK
- Add `@elevenlabs/react` package

### Step 4: Build Voice Call Component
- New component: `VoiceCallDialog.tsx`
- Uses `useConversation` hook from the SDK
- Shows call status (connecting, connected, speaking, listening)
- Microphone permission handling with clear UX
- End call button
- Optional: live transcript display

### Step 5: Integrate into Agent Cards
- Add a "Call" button to `AIAgentCard.tsx`
- Clicking it opens the `VoiceCallDialog` with the agent's context
- Pass agent personality/script as conversation overrides (if enabled in ElevenLabs dashboard)

### Step 6: Update Config
- Add function to `supabase/config.toml` with `verify_jwt = false`

## Architecture

```text
+------------------+       +-----------------------------+       +-------------------+
|  Agent Card      |       |  elevenlabs-conversation-   |       |  ElevenLabs API   |
|  [Call Button]   | ----> |  token (edge function)      | ----> |  /convai/token    |
+------------------+       +-----------------------------+       +-------------------+
        |                              |
        v                              v
+------------------+            (returns token)
| VoiceCallDialog  | <-----------------+
| useConversation  |
| (WebRTC audio)   | <--- Real-time voice via ElevenLabs WebRTC
+------------------+
```

## Files to Create/Modify
- **Create**: `supabase/functions/elevenlabs-conversation-token/index.ts`
- **Create**: `src/components/communication/VoiceCallDialog.tsx`
- **Modify**: `src/components/communication/AIAgentCard.tsx` -- add Call button
- **Modify**: `supabase/config.toml` -- register new function

## Technical Details

### Backend Function
- Uses `ELEVENLABS_API_KEY` secret to call `https://api.elevenlabs.io/v1/convai/conversation/token`
- CORS headers for browser access
- Returns `{ token }` to client

### Client Component
- `useConversation` hook manages WebSocket/WebRTC connection and audio
- `navigator.mediaDevices.getUserMedia({ audio: true })` for mic access
- `conversation.startSession({ conversationToken, connectionType: 'webrtc' })`
- Displays `conversation.status` and `conversation.isSpeaking` state
- Error handling with toast notifications

