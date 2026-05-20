
# Ambassador Communications Module — Full Build

Rebuilding `/ambassador/communications` so every ambassador can text, call, template, and track activity against the stores they own — with live Supabase data, RLS scoping, Twilio SMS/Voice, and realtime updates.

## What exists today

- Page: `src/pages/ambassador/AmbassadorCommunications.tsx` — 3 tabs render (Messages / Call Log / Templates) but show empty states. Templates are hardcoded; composer doesn't send; calls go through global `CallProvider` but nothing is logged with structure.
- Hook: `src/hooks/useAmbassadorComms.ts` — already maps ambassador → assigned stores via `ambassadors` + `ambassador_assignments` + `store_master`. Reads from `communication_messages`. Will be expanded, not replaced.
- Edge functions present: `bland-send-sms`, `gasmask-sms-inbound`, `relay-sms`, `fetch-twilio-messages`, `play-twilio-recording`, `check-twilio-health`. We'll reuse these where sensible.
- Existing canonical tables to honor: `store_master`, `ambassadors`, `ambassador_assignments`, `communication_messages`, `communication_logs`. Per governance memory (table isolation, ledger truth, three-plane comms) we will NOT create parallel `stores` / `messages` / `calls` tables — we'll layer ambassador-comm tables on top of canonical sources.

## Approach (delta vs. the spec)

The spec calls for fresh `stores`, `messages`, `calls`, `message_templates`, `ambassador_activity_log` tables. Project memory makes that a no-go (Operational Truth View pattern + Table Naming & Isolation Standard). Instead:

- **Stores** → reuse `store_master` + `ambassador_assignments` (already RLS-scoped to ambassador).
- **Messages** → reuse `communication_messages` (already used by Brandaro/VA). Add missing columns (`store_id`, `ambassador_id`, `body_translated`, `template_id`, `media_urls`) if not present.
- **Calls** → reuse `communication_logs` for call entries; add columns (`ambassador_id`, `recording_url`, `transcript`, `outcome`, `follow_up_required`, `follow_up_date`, `ai_assisted`) if missing.
- **Templates** → new `ambassador_message_templates` table (brand-prefixed per Table Isolation memory). Bilingual EN/AR, variables, usage analytics.
- **Activity log** → new `ambassador_activity_log` table (brand-prefixed). Single source for KPI strip.

This keeps ledger truth intact and avoids parallel/conflicting truth tables.

## Phase plan (each phase is a separate user-approved step)

### Phase 1 — Data layer (this turn)
1. Inspect actual columns on `communication_messages`, `communication_logs`, `store_master`, `ambassador_assignments` via `read_query`.
2. Single migration:
   - Add any missing columns to `communication_messages` and `communication_logs`.
   - Create `ambassador_message_templates` (name, category, body_en, body_ar, variables jsonb, ambassador_id, is_global, usage_count, last_used_at).
   - Create `ambassador_activity_log` (ambassador_id, store_id, action_type, metadata, created_at).
   - RLS: ambassador reads/writes only rows where `ambassador_id = (select id from ambassadors where user_id = auth.uid())`; admins (via `has_role`) see all. Global templates readable by all ambassadors.
   - Enable realtime on `communication_messages` filtered by ambassador.
3. Create Supabase Storage bucket `ambassador-media` with per-ambassador RLS.

### Phase 2 — Messages tab
- Rewrite `useAmbassadorComms` to:
  - Return one thread per assigned store (always, even with zero messages — fixes empty state).
  - Join last message + unread count from `communication_messages`.
  - Provide `useStoreMessages(storeId)` with realtime subscription.
- New edge function `ambassador-send-sms`: looks up store phone + ambassador Twilio number, sends via Twilio gateway, inserts message row, logs to activity.
- Update existing `gasmask-sms-inbound` to also write ambassador-scoped rows when From matches an assigned store.
- Composer: textarea, EN/AR toggle (RTL), template picker, media upload, quick-reply chips, optimistic UI.
- Left panel: search, filter chips (All/Unread/Overdue/Route/Borough), bulk-select mode, KPI strip above.
- Bulk outreach modal: template + per-store preview + queued sends with progress toast.

### Phase 3 — Call log tab
- Table from `communication_logs` (channel='call'), with filters, detail panel (transcript, recording player, notes, follow-up).
- Click-to-call modal: Direct (existing `CallProvider.initiateCall`) vs AI-assisted (new `ambassador-ai-call` edge function wrapping Bland.ai with persona `358e79c7` / voice `45bfac80` per spec).
- Twilio status webhook updates duration/recording.

### Phase 4 — Templates tab
- Full CRUD on `ambassador_message_templates`.
- Variable inserter, EN/AR editors, live preview with sample store, analytics (usage, reply rate, conversion rate from joined messages + orders).

### Phase 5 — Store context sidebar + role toggle
- Slide-out drawer with store stats (orders, AOV, balance, last visit), recent orders, top SKUs, visit timeline, editable notes, quick actions.
- Admin role: cross-ambassador filter + "View as Ambassador" toggle in header.

### Phase 6 — Polish
- Virtualized store list, localStorage last-viewed thread, full activity tracking on every action, KPI strip live, security/linter pass.

## Technical notes (for the reviewer)

- RLS pattern: security-definer helper `public.current_ambassador_id()` returning the ambassador row id for `auth.uid()`, used by all new policies to avoid recursion.
- Twilio creds: use existing `TWILIO_API_KEY` connector via gateway (matches Twilio memory). Each ambassador's outbound number stored on `ambassadors.twilio_number` (add column if missing).
- Realtime: enable on `communication_messages` only; client filters by `ambassador_id` to stay within RLS.
- Bland.ai: reuse existing `bland-send-sms` pattern; new `ambassador-ai-call` follows same auth model.
- All new tables get `ut_*`-style brand prefix per Table Naming memory → actual names: `ambassador_message_templates`, `ambassador_activity_log` (the `ambassador_` prefix is already the brand namespace used elsewhere in the project).

## Risks / open items

- The spec wants per-ambassador Twilio numbers; we need to confirm `ambassadors` has `twilio_number` or add it. Will inspect in Phase 1.
- Spec wants ElevenLabs transcripts on recordings — that's a follow-on background worker, not blocking. Will stub the column in Phase 1 and wire in Phase 3.
- "View as Ambassador" admin toggle requires touching the AmbassadorLayout header — small change, queued for Phase 5.

## Deliverable for this turn

Phase 1 only: schema migration + RLS + storage bucket. Once you approve and the migration runs, I'll proceed straight into Phase 2 (Messages tab) in the next turn, then Phase 3, etc. — confirming each phase works before the next, as you asked.
