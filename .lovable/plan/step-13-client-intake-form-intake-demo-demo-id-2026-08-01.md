# Step 13 — Client Intake Form (`/intake?demo={demo_id}`)

## Answer to the "check first" question

Yes, this needs special handling. The paying client is **not logged in**, and the current access rules are strict:

- `brandaro_build_jobs` — only staff (admin/dev) can read or write; only the backend service role has full access.
- `brandaro_demo_sites` — admin-only for every operation.
- The `brandaro-logos` storage bucket is private.

So a browser-side form cannot read the demo or write the build job directly. **All reads and writes go through one public edge function** (`brandaro-intake`, deployed with JWT verification off), which uses the service role internally. No access rules are loosened, and no new anonymous read access is granted on either table.

Two safety measures on that public endpoint:
1. The demo ID must correspond to a build job that is actually **paid** — otherwise the endpoint returns "not found". That prevents someone enumerating demo IDs to read business records.
2. The prefill response is **allowlisted** to only the fields the form needs (business name, colors, logo, contact info) — never internal build/status/pricing fields.
3. Once intake is submitted, resubmission is rejected (single-use), and every field is length-validated server-side.

Logo upload: the file is posted to the same edge function as base64 and stored server-side in the private `brandaro-logos` bucket, with the path saved on the job. The bucket stays private — no public write access.

## Database change

One migration, adding to `brandaro_build_jobs`:

- `intake_data` (jsonb) — the full submission
- `intake_completed` (boolean, default false)
- `intake_completed_at` (timestamp)
- `logo_storage_path` (text)

No new tables, no access-rule changes.

## Edge function: `brandaro-intake`

Public (no login), two actions:

- **Load** (`GET ?demo=<id>`): finds the paid build job for that demo, returns prefill — business name, brand colors from the demo's generated colors, existing logo, tier, and whether intake was already completed.
- **Submit** (`POST`): validates the payload, uploads the logo if present, writes `intake_data`, sets `intake_completed = true`, advances `progress_stage` to `intake_completed`, and returns the tier so the page shows the right confirmation.

Validation: business name required (max 200), email required and well-formed, domain optional (basic hostname shape, max 253), notes max 5000, colors must be hex values, logo max 5 MB and image types only.

## Frontend: `/intake`

New page `src/pages/public/BrandaroIntakePage.tsx`, registered as a standalone public route (same pattern as `/apply/beauty-specialist`), outside the protected-route tree.

Sections, in order:
1. Business name — prefilled, editable, required
2. Logo upload — optional, drag/select, preview, shows existing logo if the demo already found one
3. Brand colors — primary/secondary/accent swatch + hex input, prefilled from the demo's generated colors
4. Content notes — textarea, "anything you want changed from the demo"
5. Preferred domain — text field
6. Contact email — required

States handled: loading, invalid/unpaid demo link, already-submitted, and success.

Confirmation copy:
- starter → "Thanks! We're building your site now."
- pro / custom → "Thanks! A developer will be in touch shortly to start your build."

Styling uses the existing design tokens and shadcn components — no new colors hardcoded.

## Out of scope for this pass

- No changes to the Stripe webhook or the Durable build trigger.
- No staff-side viewer for intake submissions (can follow on the builder dashboard).
- No email notification on submit.
