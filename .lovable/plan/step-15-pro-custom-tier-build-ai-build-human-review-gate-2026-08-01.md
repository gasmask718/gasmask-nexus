# Step 15 — Pro / Custom Tier Build (AI build + human review gate)

Starter (Step 14) auto-builds via Durable and goes live. Pro/Custom instead gets its own
permanent, isolated Vercel project, deployed but **held at `review`** until David approves it
on `/brandaro/builder`.

## Trigger point

Not in `demo-stripe-webhook`. For pro/custom the build needs the intake answers (logo, colors,
content notes, domain), so the trigger is at the **end of a successful intake submission** in
`brandaro-intake`, after `intake_completed = true` is written.

```text
checkout (pro/custom) -> build_status = intake_sent  (already built, Step 14 path skips Durable)
intake submitted       -> brandaro-provision-client-site (fire-and-forget)
                          -> create Vercel project -> sync env vars -> deploy
                          -> build_status = 'review'
dev reviews on /brandaro/builder -> Update Status dropdown -> 'live'
```

The provisioning call is fired without awaiting the deploy result so the client's confirmation
screen is never blocked by Vercel latency; the job row carries all state.

## 1. New edge function: `brandaro-provision-client-site`

Internal only (`verify_jwt = true`, invoked service-to-service from `brandaro-intake`).
Input: `{ build_job_id }`. Idempotent — exits early if the job already has a
`vercel_project_id`.

Steps:
1. Load job + linked `brandaro_demo_sites` row (business name, industry, city, phone, colors,
   hero copy, services, reviews, photos, logo) and merge intake overrides on top.
2. **Create a dedicated Vercel project** via `POST https://api.vercel.com/v10/projects`:
   - `name`: `brandaro-<slugified business name>-<short job id>` (unique, DNS-safe)
   - `framework: vite`
   - `gitRepository: { type: "github", repo: "gasmask718/brandaro-base" }`
   - Not one of the 16 shared industry projects — a genuinely isolated project.
3. **Sync env vars** by reusing `upsertVercelEnvVar` from `_shared/vercelDeploy.ts` (the proven
   path) — same `VITE_*` set used for demos, with intake data winning:
   `VITE_BUSINESS_NAME`, `VITE_BUSINESS_CITY`, `VITE_BUSINESS_PHONE`, `VITE_HERO_HEADLINE`,
   `VITE_HERO_SUB`, `VITE_CTA_TEXT`, `VITE_COLOR_PRIMARY`, `VITE_COLOR_SECONDARY`,
   `VITE_SERVICES_JSON`, `VITE_ABOUT_TEXT`, `VITE_REVIEWS_JSON`, `VITE_PHOTOS_JSON`,
   `VITE_LOGO_URL`, plus `VITE_CONTENT_NOTES` for the intake notes.
   Logo: if the client uploaded one, a signed URL from the private `brandaro-logos` bucket
   (long expiry) is used for `VITE_LOGO_URL`; otherwise the existing demo logo.
   Env failures are non-fatal and logged per-key, matching the demo path.
4. **Deploy**: `POST https://api.vercel.com/v13/deployments` with the project name +
   `gitSource` on the repo's default branch (new projects have no deploy hook).
5. Persist: `vercel_project_id`, `vercel_deployment_id`, `preview_url` (the deployment URL),
   `build_status = 'review'`, `progress_stage = 'awaiting_dev_review'`, `review_requested_at`.
   On failure: `build_status = 'failed'` + `error_log`, never left silently stuck.

Nothing is pointed at a production/custom domain, so the site is only reachable at its Vercel
deployment URL until a human approves it.

## 2. `brandaro-intake` change

After a successful submit, if `package_tier` is `pro` or `custom`, invoke
`brandaro-provision-client-site` with the job id (errors swallowed and logged — the client
still sees their confirmation). Starter is untouched (Durable already fired at checkout).

## 3. Database migration

Add to `public.brandaro_build_jobs`:
- `vercel_project_id text`
- `vercel_deployment_id text`
- `preview_url text` (review URL, distinct from `deployed_url` which stays the live URL)
- `review_requested_at timestamptz`
- `reviewed_by uuid`, `reviewed_at timestamptz` (stamped when a dev flips it to `live`)

No new tables, no RLS relaxation — the table stays admin-only and the client never touches it.

## 4. Dev review surface — reuse, don't rebuild

Existing `PaidBuildsPipeline` on `/brandaro/builder` already has the `review` status and the
Update Status dropdown writing `build_status`, so that is the approval mechanism. Additions
are display-only:
- A **"Needs Review (n)"** count badge in the card header, and review rows pinned to the top
  with a highlighted row tint so they can't be missed.
- A **Preview** link on review rows opening `preview_url` in a new tab.
- The existing dropdown mutation is extended to stamp `reviewed_by`/`reviewed_at` and copy
  `preview_url` into `deployed_url` when the status is moved to `live` — that is the "approve"
  action, no separate approval UI.

No SMS/email notifier is added: the existing `admin-notify` function is TopTier-scoped
(booking/dispatch event types, TopTier recipients) and Brandaro has no equivalent, so wiring it
here would mean building a whole new channel. The builder dashboard already refetches every 30s
and is where David works. If you want a push notification too, say so and I'll add it as a
follow-up rather than folding it into this pass.

## Out of scope for this pass

Custom domain attachment, Claude-driven per-client code customization beyond env-var
personalization, and starter-tier behaviour (unchanged).
