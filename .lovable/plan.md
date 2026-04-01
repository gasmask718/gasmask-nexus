

# Brandaro VA Power Dialer System — Build Plan

## Overview
This is a massive upgrade to the existing VA Portal, transforming it from a manual click-to-call system into a fully automated power dialer with real-time leaderboard, AI coaching, and operational controls.

## What Exists Today
- `VADashboard.tsx` — sidebar-driven single-page app with view switching
- `VACallPanel.tsx` — manual call initiation via `va-initiate-call` edge function
- `VALeadsTable.tsx` — leads list with call/invoice actions
- `va_call_logs` table — basic call tracking (no excitement_level, disposition, voicemail columns)
- `twilio-voice-token` edge function — generates Twilio Client SDK tokens
- `VASessionContext` — tracks assigned Twilio number + language per session
- Scripts, Rebuttals, FAQs components already exist with i18n

## Database Migration

**New tables:**
1. `va_leaderboard_stats` — daily per-VA aggregates (calls_dialed, answered, closed, talk_time), unique on (va_id, session_date)
2. `dnc_list` — phone numbers flagged as Do Not Call, with `added_by` and `reason`
3. `va_sms_logs` — post-call SMS follow-up tracking
4. `va_daily_goals` — admin-set daily targets per VA (calls_target, closes_target)

**Alter existing tables:**
- `va_call_logs` — add columns: `excitement_level`, `disposition`, `voicemail_dropped`, `call_sid`, `callback_scheduled_at`, `va_notes`
- `brandaro_qualified_leads` — add columns: `va_notes`, `excitement_level`, `callback_scheduled_at`

**RLS:** VA sees own records, admin sees all (matching existing pattern).

## Edge Functions (3 new, 1 upgraded)

### 1. `va-power-dialer` (NEW)
Core power dialer orchestrator:
- Accepts: `vaId`, `twilioNumber`, `leadIds[]`, `action` (start/pause/resume/next)
- DNC check before each dial
- Initiates Twilio call with AMD enabled (`MachineDetection: DetectMessageEnd`)
- Sets `StatusCallback` to `va-dialer-status` for real-time updates
- Uses Twilio `<Dial>` to bridge VA (via Client SDK) to outbound call
- Returns call SID + lead info

### 2. `va-dialer-status` (NEW)
Twilio status callback webhook:
- Receives call status updates (ringing, answered, completed, no-answer, busy)
- Updates `va_call_logs` with duration, recording URL, call status
- AMD result handling — if machine detected, flags for voicemail drop
- Increments `va_leaderboard_stats` counters (dialed, answered)
- Triggers `va-post-call-analysis` for completed calls with recordings

### 3. `va-post-call-analysis` (NEW)
Post-call AI coaching pipeline:
- Fetches recording from Twilio
- Sends to AssemblyAI for transcription with speaker diarization
- Sends transcript to Lovable AI (Claude) with coaching prompt
- Saves transcript + AI analysis JSON to `va_call_logs`
- Returns coaching report

### 4. `va-initiate-call` (UPGRADE)
- Add DNC check before dialing
- Add AMD parameter support
- Add `call_sid` storage
- Keep backward compatible for manual single-call use

## Frontend Components

### New Components (~10 files)

1. **`VAPowerDialer.tsx`** — Main power dialer UI (LEFT panel, 60% width)
   - Session controls: Start/Pause/Resume/End Session
   - Current lead card with name, phone, company, notes
   - Call status indicator with live timer
   - Mute, Hold, End Call buttons
   - Excitement level buttons (HOT/WARM/COLD — large color-coded)
   - Disposition selector (required before next dial)
   - Lead notes textarea with auto-save
   - Next lead preview
   - "Drop Voicemail" button (visible when AMD detects machine)
   - "Send Follow-Up SMS" button (post-call)
   - Create Invoice button (opens modal)
   - Daily goal progress bar at top

2. **`VADialerAssist.tsx`** — Right panel (40% width)
   - Tabs: Script (with checkboxes), Rebuttals (searchable), FAQs
   - Reuses existing VAScripts, VARebuttals, VAFAQs components
   - AI Coaching modal (appears after call ends with analysis)

3. **`VALeaderboard.tsx`** — Collapsible leaderboard panel
   - Ranked table with position, VA name, 6 metrics
   - Gold/silver/bronze styling for top 3
   - HOT/WARM/COLD breakdown per VA
   - Real-time updates via Supabase Realtime subscription
   - Visible on VA dashboard (current session)

4. **`VACallbacksQueue.tsx`** — Callbacks tab
   - Lists scheduled callbacks sorted by time
   - Toast notification when callback is due
   - One-click to dial callback lead

5. **`VASessionSummary.tsx`** — End-of-session modal
   - Total calls, answered, closed, excitement breakdown
   - Average call duration, AI coaching highlights

6. **`VACoachingReport.tsx`** — Post-call AI analysis display
   - Score (1-10), summary, strengths, improvements
   - Objections raised, missed opportunities, recommended rebuttals

### New Admin Pages (3 files)

7. **`AdminLeaderboard.tsx`** — `/admin/leaderboard`
   - Full leaderboard with date range filter
   - All VAs, all metrics, exportable

8. **`AdminCallReview.tsx`** — `/admin/call-review`
   - Browse all VA calls with filters (VA, date, excitement level)
   - View transcript, listen to recording, see AI coaching

9. **`AdminVAMonitor.tsx`** — `/admin/monitor`
   - Live cards per active VA: name, current lead, call status, duration
   - Total active calls, calls today vs goal, HOT leads today
   - Real-time via Supabase Realtime

10. **`AdminDNCManager.tsx`** — `/admin/dnc`
    - Add/remove numbers from DNC list
    - Bulk import, search, export

### Modified Components

- **`VADashboard.tsx`** — Add new views: `dialer`, `leaderboard`, `callbacks`. Add nav items. Main dialer view uses split-screen layout (60/40).
- **`VALeadsTable.tsx`** — Add "Start Dialing Session" button that launches power dialer with selected/all leads.

## Routes (4 new)

| Route | Component | Access |
|---|---|---|
| `/admin/leaderboard` | `AdminLeaderboard` | Admin only |
| `/admin/call-review` | `AdminCallReview` | Admin only |
| `/admin/monitor` | `AdminVAMonitor` | Admin only |
| `/admin/dnc` | `AdminDNCManager` | Admin only |

The VA dialer, leaderboard, and callbacks are views within the existing VA dashboard (not separate routes).

## Implementation Order

1. **Database migration** — all new tables + column additions
2. **Edge functions** — `va-power-dialer`, `va-dialer-status`, `va-post-call-analysis`; upgrade `va-initiate-call`
3. **Power Dialer UI** — `VAPowerDialer.tsx` + `VADialerAssist.tsx` (split-screen layout)
4. **Leaderboard** — `VALeaderboard.tsx` + real-time subscription
5. **Callbacks + Disposition** — `VACallbacksQueue.tsx` + disposition flow
6. **AI Coaching** — `VACoachingReport.tsx` + post-call modal
7. **Session Summary** — `VASessionSummary.tsx`
8. **Admin pages** — Leaderboard, Call Review, Monitor, DNC
9. **Dashboard integration** — wire all new views into `VADashboard.tsx`
10. **Routes** — register 4 admin routes in `AppRoutes.tsx`

## Technical Notes

- Twilio Client SDK token generation already exists in `twilio-voice-token` edge function — reuse for browser-based audio
- Power dialer uses Twilio's `<Dial><Client>` TwiML to bridge VA's browser connection to outbound calls
- AMD requires Twilio account-level enablement — will show setup note in UI
- AssemblyAI API key needed as a secret for transcription
- AI coaching uses Lovable AI (supported model) — no external API key needed
- Leaderboard uses `ALTER PUBLICATION supabase_realtime ADD TABLE va_leaderboard_stats` for live updates
- All edge functions use the existing Twilio connector gateway pattern

