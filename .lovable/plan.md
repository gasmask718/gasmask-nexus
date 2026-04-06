

# VA Dashboard Global Calling System Refactor

## Problem
When a VA navigates away from `/va/dashboard`, the call UI disappears but the Twilio call continues in the background. The user loses all call controls (mute, hang up, timer). This is because the call UI components (`VAPowerDialer`, `VACallPanel`) are mounted only inside the dashboard page component.

## Current Architecture
- `VoiceDeviceProvider` (global) — manages Twilio Device, token, raw call state
- `CallProvider` (global) — wraps VoiceDeviceProvider, renders `ActiveCallOverlay` and `GlobalCallHUD`
- `VACallPanel` / `VAPowerDialer` — dashboard-local components that duplicate call state tracking with their own `useEffect` syncing `voice.callStatus`

The `CallProvider` already renders `ActiveCallOverlay` globally, but the VA dashboard components maintain their own parallel call state that doesn't feed back into the global provider. The VA components directly call `voice.makeCall()` bypassing `CallProvider`.

## Solution

### Step 1: Extend CallProvider with VA-specific state
Add fields to the global `CallContext` to support VA workflow needs:
- `callDuration` (live seconds counter)
- `isMuted` (expose from VoiceDeviceProvider)
- `isMinimized` flag
- `direction` (inbound/outbound)
- `minimize()` / `expand()` actions
- `vaCallMetadata` (lead info, disposition, notes) for VA-specific context

### Step 2: Create a persistent `VACallWidget` component
A floating bottom-right widget that:
- Renders globally (mounted in `CallProvider` or `App.tsx`)
- Shows only when there's an active call AND user is NOT on `/va/dashboard`
- Displays: timer, contact name, mute/hangup/expand buttons
- Expand navigates back to `/va/dashboard` or opens a mini-modal
- Uses framer-motion for smooth transitions

### Step 3: Refactor VAPowerDialer and VACallPanel
- Remove their local call state duplication (`callStatus`, `seconds`, timer refs)
- Consume call state from `useCall()` global context instead
- Route all `voice.makeCall()` calls through `CallProvider.placeCallNow()` so global state stays in sync
- Pass `onCallStarted` / `onCallEnded` callbacks up for VA-specific logging

### Step 4: Add automatic call recording
Update the `twilio-voice-token` edge function's TwiML app or the `placeCall` flow to include `record: true` parameter when connecting via `device.connect()`. The Twilio `Call.connect()` params will include `Record=true`.

### Step 5: Enhance database call logging
The `va_call_logs` table already exists with `call_sid`, `recording_url`, `duration_seconds`, `disposition`, etc. Ensure:
- `CallProvider.placeCall` creates a `va_call_logs` row on call start
- On call end, update with duration, recording URL, and status
- Add `provider_call_sid` and `direction` columns if missing

### Step 6: Fix dashboard metrics
- `VALeaderboard` already queries `va_leaderboard_stats` with realtime subscription — verify it works
- Add a `VARecentCalls` component querying `va_call_logs` for the current VA
- Add summary stats (calls today, total duration) from `va_leaderboard_stats`

## Files to Create/Edit

| File | Action | Purpose |
|------|--------|---------|
| `src/components/communication/CallProvider.tsx` | Edit | Add VA metadata, duration counter, minimize state, direction |
| `src/components/va/VACallWidget.tsx` | Create | Floating persistent call widget for off-dashboard navigation |
| `src/components/va/VAPowerDialer.tsx` | Edit | Remove local state duplication, use global `useCall()` |
| `src/components/va/VACallPanel.tsx` | Edit | Remove local state duplication, use global `useCall()` |
| `src/components/va/VARecentCalls.tsx` | Create | Recent calls list component for dashboard |
| `src/components/va/VACallStats.tsx` | Create | Today's call statistics card |
| `src/pages/va/VADashboard.tsx` | Edit | Add stats and recent calls sections |
| `src/App.tsx` | Edit | Mount `VACallWidget` globally alongside existing providers |
| DB migration | Create | Add `direction` column to `va_call_logs` if missing |

## Technical Details

**Call state flow (after refactor):**
```text
VAPowerDialer/VACallPanel
  → useCall().placeCallNow({ phone, leadId, entityName })
    → CallProvider.placeCall()
      → voice.makeCall(phone, { Record: "true" })
      → INSERT va_call_logs (status: 'initiated')
      → setActiveCallInfo({ callSid, leadId, ... })
      → Start duration timer

ActiveCallOverlay (global, visible on dashboard)
VACallWidget (global, visible off-dashboard)
  → Both read from CallContext
  → hangUp / mute / minimize all go through CallProvider
```

**Widget visibility logic:**
```text
const location = useLocation();
const isOnDashboard = location.pathname === '/va/dashboard';
const showWidget = activeCall && !isOnDashboard;
const showOverlay = activeCall && isOnDashboard;
```

**Recording:** Pass `Record=true` in Twilio Device connect params. The recording URL will be fetched via a status callback webhook or polling after call completion.

