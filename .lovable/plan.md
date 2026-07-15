# Brandaro Auto-Demo Builder — Phase 1 Plan

Building the foundation for Sara AI's "Send Demo" flow inside Dynasty OS (project `e9aba3c3`, Supabase `qalaaroashbggynpvqct`). This plan covers the vertical slice that gets a VA from button-click → prospect receives SMS with a live demo URL. Ideogram logo generation, Vercel deploys, and Claude audit/auto-fix are scaffolded as stubs to be filled in Phase 2.

## Scope of Phase 1

1. **Database schema** in Dynasty OS Supabase
2. **Edge function** `generate-demo-site` (Google Places → Claude copy → row write → SMS trigger)
3. **VA dashboard** at `/brandaro/builder` — Send Demo button, live status, recent demos list
4. **Storage bucket** for `DESIGN.md` industry files
5. **SMS delivery** via existing Twilio integration

## Defaults I'm assuming (say the word to change any)

- **AI model**: Claude via `dd_ai_config.anthropic_key` (matches spec + existing pattern)
- **SMS**: existing Brandaro Twilio integration (per memory `communication-systems/brandaro-twilio-voice-integration`)
- **Ideogram / Vercel / audit loop**: stubbed with TODO in Phase 1, wired in Phase 2 once keys are provided
- **Route**: `/brandaro/builder` added to `Layout.tsx` under existing Brandaro hub

## Database (single migration)

```
brandaro_demos
  id, lead_id (fk brandaro_leads), va_user_id
  business_name, phone_e164, address, city, state, zip
  industry, google_place_id, google_data jsonb, reviews jsonb
  logo_url, demo_url, vercel_deployment_id
  status enum: queued|fetching_places|generating_copy|generating_logo|deploying|auditing|fixing|ready|sms_sent|failed
  error_message, sms_sent_at
  created_at, updated_at

demo_audit_scores
  demo_id, pass_number, overall_score, dimension_scores jsonb, issues jsonb, created_at

demo_deploy_events
  demo_id, event_type, payload jsonb, created_at
```

All three tables: RLS on, `authenticated` + `service_role` GRANTs, VA/admin read-write policies via `has_role`.

Storage bucket `brandaro-design-templates` (private) for the 16 industry `DESIGN.md` files.

## Edge function: `generate-demo-site`

Input: `{ lead_id }` from VA button. Steps:

1. Insert `brandaro_demos` row (status=queued)
2. Google Places lookup (uses `GOOGLE_PLACES_API_KEY` secret — request if missing)
3. Claude: detect industry → pick DESIGN.md from storage → generate copy JSON
4. Ideogram logo (stubbed — placeholder URL until key added)
5. Vercel deploy (stubbed — writes fake `*.demo.brandaro.io` URL until token added)
6. Audit pass (stubbed)
7. Twilio SMS to prospect with demo URL
8. Update status → `sms_sent`

Every step writes a `demo_deploy_events` row for observability. Any failure sets status=`failed` + `error_message`.

## VA dashboard `/brandaro/builder`

- Lead search / picker (from `brandaro_leads`)
- Big **Send Demo** button (one click, disabled while in-flight)
- Live status pill via Supabase realtime subscription on `brandaro_demos`
- Recent demos table: business, status, demo URL, SMS sent time, retry button on failed
- Uses existing Brandaro dark-luxury design tokens (per `style/top-tier-hub-aesthetic` and Brandaro memory)

## Secrets to request

Phase 1 needs only:
- `GOOGLE_PLACES_API_KEY`

`anthropic_key` already exists in `dd_ai_config`. Twilio already connected. Ideogram + Vercel deferred to Phase 2.

## Out of scope (Phase 2)

- Real Ideogram logo generation
- Real Vercel programmatic deploys per demo
- Claude audit loop with auto-fix (max 2 passes)
- Stripe checkout on the demo site's "Get This Site" button
- Durable API paid-build pipeline
- Tier 2+ Lovable clone pipeline

## Order of operations

1. Migration (DB + storage bucket + RLS)
2. Request `GOOGLE_PLACES_API_KEY`
3. Edge function `generate-demo-site` + `_shared/brandaro.ts` helpers
4. `/brandaro/builder` UI + Layout registration
5. Manual smoke test with one real lead
