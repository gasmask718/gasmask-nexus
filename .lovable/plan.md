

# Brandaro VA Power Dialer — Patch Build Plan

## Summary
14 additive features patching the existing power dialer. No rebuilds. Architectural change: Conference bridge replaces direct Dial for barge/whisper support.

## Database Migration (single migration)

**New tables:**
- `va_voicemail_templates` — language-specific audio URLs for voicemail drops
- `va_dialer_settings` — queue priority, dial pace, no-answer timeout (singleton config)
- `va_monitor_logs` — admin barge/whisper/listen session tracking

**Alter existing:**
- `va_call_logs` ADD `trend_analysis JSONB`
- `va_sessions` ADD `paused_by UUID`, `pause_reason TEXT`, `paused_at TIMESTAMPTZ`

**Seed:** Insert default `va_dialer_settings` row with default queue priority and 3s dial pace.

**RLS:** VA sees own records, admin sees all — matching existing pattern on all new tables.

**Realtime:** Enable realtime on `va_call_logs` (for HOT lead alerts) and `va_sessions` (for pause signals).

## Edge Function Changes (3 modified, 1 new)

### `va-power-dialer` (MODIFY — architectural change)
- **Conference bridge**: Replace `<Dial><Number>` TwiML with `<Dial><Conference>` using a named conference per call (conference name = callLogId). This enables admin join for barge/whisper/listen.
- **Queue priority**: On `action: 'dial'`, fetch `va_dialer_settings.queue_priority` and reorder the lead before dialing. (Client already sends leadId, but add a `sortLeads` action that returns sorted lead IDs based on priority config.)
- **Timeout**: Already passes `Timeout: "20"` — confirmed working. Add auto-disposition to `no_answer` in `va-dialer-status` instead.
- **Voicemail play**: Add `action: 'drop_voicemail'` that fetches active `va_voicemail_templates` for the session language and returns `<Play>` TwiML to the conference.

### `va-dialer-status` (MODIFY)
- On `no-answer` status: auto-set disposition to `no_answer` in call log (no VA interaction needed).
- On `in-progress` with `answeredBy === 'human'` + `excitement_level === 'hot'`: broadcast Realtime event on `admin-alerts` channel.

### `va-post-call-analysis` (MODIFY)
- After individual call analysis, fetch last 5 call analyses for the VA.
- If 3+ exist, send to Lovable AI with trend coaching prompt.
- Save trend analysis to `va_call_logs.trend_analysis`.

### `va-admin-monitor` (NEW edge function)
- `action: 'join_conference'` — generates Twilio TwiML for admin to join a named conference in listen/whisper/barge mode using Conference participant properties (`muted`, `coach`).
- `action: 'pause_va'` — updates `va_sessions` with `paused_by`, `pause_reason`, `paused_at` and broadcasts on Realtime channel `dialer-control-{vaId}`.
- `action: 'resume_va'` — clears pause fields and broadcasts resume.
- `action: 'reassign_callback'` — updates callback lead's VA assignment and broadcasts notification.

### `va-session-email` (NEW edge function)
- Receives session stats, formats HTML email in Brandaro dark navy/teal theme.
- Sends via Resend connector to VA email + all admin emails.
- Includes: calls dialed/answered/closed, HOT/WARM/COLD breakdown, avg duration, top 3 AI coaching points, link to call review.

## Frontend Components

### New Components (6 files)

1. **`VACallHistory.tsx`** — Collapsible panel showing previous call attempts for current lead (date, duration, disposition badge, excitement, VA name, notes). Used inside VAPowerDialer below the lead card.

2. **`VACallPlayer.tsx`** — Simple HTML5 `<audio>` wrapper with play/pause, seek, and playback speed. Used in "My Calls" view and admin call review.

3. **`VAMyCalls.tsx`** — Table of VA's own completed calls with inline audio player, coaching report viewer, and AI score display. New sidebar nav item "My Calls".

4. **`AdminDialerSettings.tsx`** — Admin settings page at `/admin/settings` with:
   - Voicemail template upload (per language EN/ES) using Supabase Storage
   - Queue priority drag-to-reorder list
   - Dial pace slider (0-30 seconds)
   - No-answer timeout config

5. **`AdminHotLeadsPanel.tsx`** — Real-time "HOT Leads Today" section for AdminVAMonitor showing lead name, VA, time, phone. Uses Supabase Realtime subscription on `va_call_logs`.

6. **`AdminMonitorPanel.tsx`** — Per-VA monitoring controls (Listen/Whisper/Barge buttons, Pause/Resume toggle, callback reassignment modal). Embedded in AdminVAMonitor VA cards.

### Modified Components (7 files)

1. **`VAPowerDialer.tsx`**
   - Add dial pace countdown ("Next call in 3... 2... 1..." with "Dial Now" skip button)
   - Add queue order label at top
   - Add collapsible `<VACallHistory>` below lead card
   - Subscribe to `dialer-control-{vaId}` Realtime channel for admin pause/resume signals
   - Show "Session paused by admin" banner when paused
   - On HOT excitement click, broadcast to `admin-alerts` channel
   - On no_answer from webhook, show "No Answer — Moving to next..." for 2 seconds then auto-advance

2. **`VAOnboardingModal.tsx`**
   - Check available numbers count before allowing session start
   - If zero available: show warning, disable Start, poll every 30s
   - Subscribe to Realtime on `brandaro_phone_numbers` for live availability updates
   - Show "X of Y lines available" counter

3. **`VALeaderboard.tsx`**
   - Add time range toggle: [Today] [This Week] [This Month] [All Time]
   - Aggregate `va_leaderboard_stats` with SUM for non-today ranges
   - Add streak column (consecutive days hitting target)

4. **`AdminLeaderboard.tsx`**
   - Add same time range toggle + custom date range picker
   - Default to "This Week"

5. **`AdminVAMonitor.tsx`**
   - Add Monitor/Pause/Resume buttons per VA card
   - Add HOT Leads Today section with real-time updates
   - Add HOT Leads counter badge in summary cards
   - Embed `AdminMonitorPanel` per active VA

6. **`AdminCallReview.tsx`**
   - Add "Reassign Callback" button for callback-disposition calls
   - Show trend analysis section when available
   - Add VA filter dropdown

7. **`VACoachingReport.tsx`**
   - Add trend section at bottom (arrow indicator, improving/declining areas, trend message)

8. **`VASessionSummary.tsx`**
   - Add "Email Summary" button that invokes `va-session-email` edge function
   - Auto-send to admins on session end

9. **`VADashboard.tsx`**
   - Add "My Calls" nav item and view routing to `VAMyCalls`

## Routes (1 new)

| Route | Component | Access |
|---|---|---|
| `/admin/settings` | `AdminDialerSettings` | Admin only |

"My Calls" is a view within VADashboard (no new route).

## Storage

Create a `voicemail-templates` bucket in Supabase Storage for admin voicemail audio uploads. Public read access (Twilio needs to fetch the URL).

## Connector Setup

- **Resend** connector needed for session summary emails (section 14). Will use `standard_connectors--connect` during implementation.

## Implementation Order

1. Database migration (3 new tables + 2 ALTER + seed + RLS + realtime)
2. Storage bucket for voicemail audio
3. Conference bridge refactor in `va-power-dialer` (architectural prerequisite for barge/whisper)
4. `va-dialer-status` updates (no-answer auto-disposition, HOT alert broadcast)
5. `va-admin-monitor` edge function (join conference, pause/resume, reassign)
6. `va-post-call-analysis` trend coaching addition
7. `AdminDialerSettings.tsx` — voicemail upload + queue priority + dial pace
8. `VAPowerDialer.tsx` — dial pace countdown, queue label, call history, admin pause listener, HOT broadcast, no-answer auto-advance
9. `VAOnboardingModal.tsx` — concurrency guard
10. `VACallHistory.tsx` + `VACallPlayer.tsx` + `VAMyCalls.tsx`
11. `AdminVAMonitor.tsx` — monitor panel, HOT leads, pause buttons
12. `AdminCallReview.tsx` — reassign callbacks, trend display
13. `VALeaderboard.tsx` + `AdminLeaderboard.tsx` — time range toggles + streaks
14. `VACoachingReport.tsx` — trend section
15. `VASessionSummary.tsx` + `va-session-email` — email delivery
16. `VADashboard.tsx` — add My Calls view
17. Routes — register `/admin/settings`

