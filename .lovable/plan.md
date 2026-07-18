## Scope

Three builds, all in Dynasty OS (`e9aba3c3` + Supabase `qalaaroashbggynpvqct`). No cross-project work.

---

## 1. `/brandaro/builder` Hub (Dynasty OS)

**New page:** `src/pages/brandaro/BuilderHubPage.tsx`
- Header: "Website Builder Engine" + live stats (demos generated today, ready-to-send, paid tier queue).
- **Generate section** — pick a qualified lead (dropdown from `brandaro_qualified_leads`), choose engine (`native` / `durable`), "Generate Demo" button → invokes `brandaro-generate-demo`.
- **Recent Demos table** — from `brandaro_demo_sites` (last 50): business, industry, engine, status (generating/ready/error), demo URL (open), audit score, "Send SMS" button (invokes `brandaro-send-demo`).
- **Design system status** — counts `.md` files in `brandaro-design-mds` bucket; lists missing industries (from a hardcoded expected set of 16) with a badge.
- **Durable job monitor** — separate tab showing rows where `generation_engine='durable'` with `durable_job_status` and `durable_last_error`.

**Route:** register `/brandaro/builder` in `src/routes/AppRoutes.tsx` under the Brandaro protected block. Sidebar entry in `src/modules/brandaro/index.ts` → "Builder Hub" under Brandaro group.

**Guards:** admin + brandaro roles only (matches other Brandaro pages).

---

## 2. Wire real AI pipeline into `brandaro-generate-demo`

Rewrite the `engine === "native"` branch. Preserve fallback so it still works even if a piece is missing.

**Steps inside function:**
1. Fetch lead (already done).
2. Map `lead.industry` → design filename (e.g. `restaurant`, `cleaning`, `landscaping` etc.); default to `general.md`.
3. `supabase.storage.from('brandaro-design-mds').download(<industry>.md)` → decode as text. If missing, continue with empty design context (log warning, still generate).
4. Call Lovable AI (`https://ai.gateway.lovable.dev/v1/chat/completions`, header `Authorization: Bearer ${LOVABLE_API_KEY}`, model `google/gemini-2.5-flash`, `response_format: json_object`) with:
   - System: "You are a senior web copywriter. Follow the DESIGN.md system precisely. Return JSON matching the schema."
   - User: lead fields (business_name, industry, city, state, services, phone, google reviews if present) + full DESIGN.md content as reference.
   - Expected JSON:
     ```json
     {
       "hero_headline": "string",
       "hero_subheadline": "string",
       "services": [{"name":"string","description":"string"}],
       "about_paragraph": "string",
       "cta_text": "string",
       "color_primary": "#hex",
       "color_secondary": "#hex",
       "font_recommendation": "string"
     }
     ```
   - Handle `429` / `402` → set `generation_status='error'`, `error_message=<gateway reason>`, return early with clean error.
5. Merge AI JSON into `generateNativeHtml`, using AI colors/fonts + services structure. Save AI JSON to `content_blocks`, colors to `generated_colors`.
6. Insert into `brandaro_demo_sites` with `generation_status='ready'`, `template_used=<industry>`, `content_blocks`, `generated_colors`, `demo_url`, `generated_html`.

**Vercel deploy-hook path (optional/env-gated):** if `VERCEL_DEPLOY_HOOK_<industry>` secret exists AND `deploy_vercel=true` in request body, POST to it with `DESIGN_MD_CONTENT` (base64) + business content payload. Store returned deployment id in `vercel_deployment_id`. If secret missing, silently skip Vercel and keep the native HTML as the demo. No blocker.

**Secrets:** `LOVABLE_API_KEY` (already present). No new secrets required to ship — Vercel hooks are opt-in per industry.

---

## 3. Durable API integration (Tier-1 auto-build)

**Rewrite `engine === "durable"` branch:**
1. Insert `brandaro_demo_sites` row with `generation_engine='durable'`, `durable_job_status='queued'`.
2. `POST https://api.durable.co/v1/sites` (or the current Durable endpoint — will use their docs; using `Authorization: Bearer ${DURABLE_API_KEY}`) with body:
   - business_name, industry, city, state, phone, services, brand colors (from any prior native generation on same lead if available).
3. Store returned `site_id` in `durable_site_id`, `site_url` in `durable_generated_url`, set `durable_job_status='processing'`.
4. On non-200 → `durable_job_status='error'`, `durable_last_error=<body>`, `generation_status='error'`.

**New callback function:** `supabase/functions/brandaro-durable-webhook/index.ts`
- Receives Durable webhook (site.ready / site.failed).
- Verifies via shared secret header `X-Durable-Signature` (compare to `DURABLE_WEBHOOK_SECRET`).
- Updates matching `brandaro_demo_sites` row by `durable_site_id`: sets `durable_job_status`, `durable_generated_url`, `durable_screenshot_url`, `generation_status='ready'`, `demo_ready_for_conversion=true`.

**Secrets required (I will request via add_secret in a follow-up message, not this turn):**
- `DURABLE_API_KEY` — from durable.co dashboard
- `DURABLE_WEBHOOK_SECRET` — user creates + pastes into Durable webhook config

The Durable branch will insert a queued row and return a clear error if the key is missing — no crash.

---

## Technical Notes

- No destructive migrations. `brandaro_demo_sites` already has every column needed (`content_blocks`, `generated_colors`, `durable_*`, `vercel_*`, `audit_*`).
- All edge functions auto-deploy on save.
- Model: `google/gemini-2.5-flash` (fast/cheap, JSON-capable, well within Lovable AI catalog).
- No changes to existing `brandaro_qualified_leads`, VA UI, or receptionist flow.
- Reuse existing `SendReceptionistLinkModal` pattern for the send-demo action wiring.

## Out of Scope (per your instructions)

- Uploading the 16 DESIGN.md files (you'll do it).
- Adding Durable / Vercel secrets (I'll request in a follow-up once you approve).
- Building the 16 Vercel industry templates (out of Lovable).
- Master template GitHub repo work.

---

**On approval, I'll ship all three in one batch of parallel writes**, then ask you for the Durable API key + webhook secret to activate Tier-1.