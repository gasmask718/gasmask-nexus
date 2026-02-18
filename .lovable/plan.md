

# Connect Twilio Call Functionality to AI Agents Page

## Current State
- The `/communication/agents` page lets you select a store, pick an AI agent, then opens a **browser-only** ElevenLabs voice dialog (microphone-based conversation with the AI).
- A fully working **Twilio outbound calling** system already exists (`place-outbound-call` edge function, `useOutboundCall` hook, `CallProvider` context) -- used across the app via `useCall()`.
- These two systems are **not connected** on the Agents page. Clicking "Call" only starts the ElevenLabs browser voice session without actually dialing the store's phone.

## What Will Change

### 1. Add Twilio Call to the Agent Call Flow
When a user selects an agent and confirms, the system will:
1. **First** place a Twilio outbound call to the store's phone number using the existing `useCall().initiateCall()` (or `placeCallNow` for a direct call).
2. **Then** open the `VoiceCallDialog` for the ElevenLabs AI agent session simultaneously, so the user can monitor/interact with the AI while the phone rings.

### 2. Update `AIAgentsPanel.tsx`
- Import and use the `useCall()` hook from `CallProvider`.
- Modify `handleAgentConfirm` to trigger a Twilio call to `selectedStore.phone` in addition to opening the ElevenLabs voice dialog.
- Add a safeguard: if the store has no phone number, show a toast error instead of attempting the call.

### 3. Update `AgentSelectorDialog.tsx`
- Disable the "Start Call" button if the store has no phone number.
- Show a warning message when the store phone is missing.

## Technical Details

**File: `src/components/communication/AIAgentsPanel.tsx`**
- Add `import { useCall } from "@/components/communication/CallProvider";`
- In `handleAgentConfirm`, call `initiateCall({ destinationPhone: selectedStore.phone, entityType: "store", entityName: selectedStore.store_name })` before opening the VoiceCallDialog.
- Alternatively, use `useOutboundCall().placeCallNow()` directly to skip the confirmation modal (since the AgentSelectorDialog already serves as confirmation).

**File: `src/components/communication/AgentSelectorDialog.tsx`**
- Add a disabled state + warning when `storePhone` is null/empty.

## No Backend Changes
The `place-outbound-call` edge function and all Twilio configuration are already in place. This is a frontend-only wiring change.

