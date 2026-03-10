

## Plan: Fix Build Errors + Campaign Voice Pipeline + Transcript Logging

### Problem Summary

There are 17 build errors across multiple edge functions, plus the campaign dashboard's "Logs" tab is a placeholder. The core voice pipeline (Twilio TTS opener -> ElevenLabs AI handoff) is already wired but needs fixes to compile and properly use the campaign's script from Step 4.

### Part 1: Fix All Build Errors (17 errors across ~10 files)

These are mechanical TypeScript fixes:

1. **`apply-call-disposition/index.ts` (line 149)**: Replace `.catch()` on Supabase query with proper `{ data, error }` destructuring pattern.

2. **`auto-draft-batches/index.ts` (line 77)**: Change `err.message` to `(err as Error).message` (or `err instanceof Error ? err.message : String(err)`).

3. **`aws-polly-tts/index.ts` (line 38)**: Fix `ArrayBufferLike` type issue by casting: `key instanceof ArrayBuffer ? new Uint8Array(key) : key` and passing `.buffer` correctly, or use `as ArrayBuffer`.

4. **`create-ops-thread/index.ts` (line 130)**: Type `err` as `unknown`, use safe access.

5. **`generate-shipping-label/index.ts` (line 166)**: Same `err.message` fix.

6. **`ingest-google-places/index.ts` (line 320)**: Add type annotation `(t: string)` to the `.map()` callback.

7. **`marketplace-order-engine/index.ts` (line 232)**: Same `err.message` fix.

8. **`predictive-dialer-engine/index.ts` (lines 1214-1225)**: The `outcome` variable is typed too narrowly (`"failed" | "voicemail" | "no_answer"`), excluding `"answered"`. Widen the type to include `"answered"` at the declaration site.

9. **`process-notification-queue/index.ts` (lines 249, 263)**: Two `err.message` fixes.

10. **`process-settlements/index.ts` (line 41)**: Same `err.message` fix.

11. **`production-alert-engine/index.ts` (line 125)**: Same `err.message` fix.

12. **`twilio-outbound-call/index.ts` (line 67)**: The `.select()` returns `dialer_campaigns` as an array (joined relation). Fix: access `item.dialer_campaigns?.[0]?.agent_id` or add `.single()` semantics, or destructure properly. The select returns an array for joined tables -- need to handle `item.dialer_campaigns` as array.

### Part 2: Campaign Script in TwiML (twilio-outbound-call)

Currently line 75 hardcodes: `"Hello ${item.contact_name}. Are you ready to speak with our AI assistant?"`. 

**Fix**: Read the campaign's `initial_script` from the joined `dialer_campaigns` relation and use it as the TwiML `<Say>` content. Fall back to the current default if no script is set.

### Part 3: Transcript Logging in Campaign Dashboard

The "Logs" tab (line 706-710) is a static placeholder. 

**Fix**: Query `live_call_transcripts` by matching `call_sid` values from the campaign's `outbound_call_queue` items (which have `twilio_call_sid`). Also query `call_recordings` for completed calls. Display per-contact transcript threads grouped by call.

Additionally, ensure the `twilio-call-status` webhook also handles campaign calls (not just manual calls) -- it currently only saves transcripts when `recording.manual_call_id` exists. Need to add a parallel path that checks for campaign queue items by `provider_call_sid` and fetches/stores ElevenLabs transcripts for those too.

### Part 4: ElevenLabs Bridge Separation

The existing `twilio-gather-webhook` already redirects to `twilio-elevenlabs-bridge` when the user confirms. This flow is correct:

1. `twilio-outbound-call` -> Twilio dials with TwiML containing `<Gather>` pointing to `twilio-gather-webhook`
2. `twilio-gather-webhook` -> If user says yes/presses 1, `<Redirect>` to `twilio-elevenlabs-bridge`
3. `twilio-elevenlabs-bridge` -> Registers with ElevenLabs API, returns their TwiML

This is already a separate webhook. No new function needed -- just ensure it's working correctly with the campaign's agent_id.

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/apply-call-disposition/index.ts` | Fix `.catch()` pattern |
| `supabase/functions/auto-draft-batches/index.ts` | Type-safe error |
| `supabase/functions/aws-polly-tts/index.ts` | Fix ArrayBuffer type |
| `supabase/functions/create-ops-thread/index.ts` | Type-safe error |
| `supabase/functions/generate-shipping-label/index.ts` | Type-safe error |
| `supabase/functions/ingest-google-places/index.ts` | Add type annotation |
| `supabase/functions/marketplace-order-engine/index.ts` | Type-safe error |
| `supabase/functions/predictive-dialer-engine/index.ts` | Widen outcome type |
| `supabase/functions/process-notification-queue/index.ts` | Type-safe errors |
| `supabase/functions/process-settlements/index.ts` | Type-safe error |
| `supabase/functions/production-alert-engine/index.ts` | Type-safe error |
| `supabase/functions/twilio-outbound-call/index.ts` | Fix array join access + use campaign script |
| `supabase/functions/twilio-call-status/index.ts` | Add campaign transcript path (not just manual calls) |
| `src/pages/communication/dialer/CampaignWizardPage.tsx` | Build real Logs tab with transcript display |

