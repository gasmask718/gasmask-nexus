## Goal
On `/communication/auto-dialer` → **Campaigns** tab, replace the ElevenLabs agent picker and outbound call pipeline with **Bland AI agents**, while preserving identical UX (script templates → agent → call queue → recordings/transcripts). Add an **Agent Webhook Directory** at the bottom of the campaigns view, plus the requested DB tables and Bland edge functions.

## Note on stack
This project is **React + Vite + Supabase**, not Next.js. The "API routes" requested will be implemented as **Supabase Edge Functions** (the Lovable equivalent), reachable via `supabase.functions.invoke()`. Functionally identical to the requested Next routes.

---

## 1. Database changes (migration)

Three new tables (named with a `bland_` prefix to follow the project's table-isolation rule, while still aliasing the requested logical names):

- **`bland_leads`** — `id uuid pk`, `business_id uuid`, `name text`, `phone_number text not null`, `status text` (check: `new|interested|callback|not-interested`), `pain_points text`, `created_at timestamptz default now()`.
- **`bland_call_logs`** — `id uuid pk`, `lead_id uuid fk → bland_leads(id) on delete cascade`, `agent_type text`, `call_id text` (Bland call id), `transcript text`, `recording_url text`, `call_outcome text`, `raw_payload jsonb`, `created_at timestamptz default now()`.
- **`bland_agent_webhooks`** — `id uuid pk`, `agent_name text not null`, `agent_type text`, `webhook_url text not null`, `is_active boolean default true`, `created_at timestamptz default now()`.

RLS: enable on all three. Authenticated users `select/insert/update`. Service role full access (used by edge functions and Bland webhook).

Seed `bland_agent_webhooks` with the four agents the user listed:
- Sales-Outreach
- Follow-up Call
- Reactivation / Win-back
- Inventory Check

Each row's `webhook_url` is auto-set to the deployed `bland-agent-webhook` edge function URL.

Add `bland_agent_id text` and `agent_provider text default 'elevenlabs'` columns to `dialer_campaigns` so Bland-routed campaigns are tagged.

## 2. Edge functions (Supabase, replace the requested Next routes)

### `bland-agent-trigger`  (replaces `/api/agent/trigger`)
- Input: `{ lead_id, agent_type, prompt?, voice? }` (also accepts `phone_number` directly for ad-hoc calls from the queue dispatcher).
- Reads `BLAND_API_KEY` from secrets; returns 500 with clean error if missing.
- Looks up phone in `bland_leads` when `lead_id` provided.
- POSTs to `https://api.bland.ai/v1/calls` with `{ phone_number, task: prompt, voice: voice||'maya', metadata: { lead_id, agent_type } }` and `authorization: <key>` header.
- Returns the Bland `call_id` to caller.

### `bland-agent-webhook`  (replaces `/api/agent/webhook`)
- Public endpoint (`verify_jwt = false`) so Bland can hit it.
- Parses the post-call payload: `call_id`, `variables.phone_number`, `transcript`, `recording_url`, `call_outcome`, `metadata.lead_id`.
- If `lead_id` (or matched by `phone_number`) → updates `bland_leads.status` based on `call_outcome` (mapping: `interested → interested`, `callback → callback`, `not-interested → not-interested`, default keeps current).
- Inserts a row into `bland_call_logs` with transcript, recording_url, call_id, agent_type, raw payload.
- Returns `{ ok: true }`.

Secret needed: **`BLAND_API_KEY`** (will be added via add_secret using the value the user supplied).

## 3. Campaigns tab UI changes (`CampaignWizardPage.tsx`)

Inside the existing **Campaigns** tab — no layout/UX rewrite, only the agent layer swapped:

- Replace the `elevenlabs_agents` query with a `bland_agent_webhooks` query (active only).
- Rewrite `SCRIPT_TEMPLATES` so each template maps to a Bland agent **type** (`sales-outreach`, `follow-up`, `reactivation`, `inventory-check`) instead of an ElevenLabs `agentId`.
- The agent dropdown (Step 4: Script & AI) now lists Bland agents from `bland_agent_webhooks`. Selecting one stores `agent_type` + agent row id into `form.agent_id` and tags the campaign with `agent_provider='bland'`.
- Queue dispatcher (`processQueue`): when the campaign's `agent_provider='bland'`, invoke the new `bland-agent-trigger` function instead of `twilio-outbound-call`. Existing ElevenLabs/Twilio path stays intact for legacy campaigns (zero-disruption switch).
- Recordings/transcripts panel keeps reading from `bland_call_logs` joined by `call_id` so they show up the same way.

## 4. Agent Webhook Directory (bottom of Campaigns tab)

New section appended **at the very end** of the Campaigns tab (below all existing tables):

- Heading "Agent Webhook Directory" with a refresh button.
- Grid of cards (responsive, 2-up on desktop) — one per row of `bland_agent_webhooks`:
  - Agent Name
  - Agent Type pill
  - Webhook Endpoint URL with copy-to-clipboard button
  - Active / Inactive badge (green / muted) with toggle
  - Created date
- Empty-state message if no rows.

## 5. Files

**Created**
- `supabase/migrations/<ts>_bland_ai_agents.sql` — 3 tables + RLS + seed + `dialer_campaigns` columns.
- `supabase/functions/bland-agent-trigger/index.ts`
- `supabase/functions/bland-agent-webhook/index.ts`
- `src/components/communication/BlandAgentWebhookDirectory.tsx`

**Edited**
- `src/pages/communication/dialer/CampaignWizardPage.tsx` — swap agents source, rewrite `SCRIPT_TEMPLATES`, update dispatcher branch, mount `<BlandAgentWebhookDirectory />` at the bottom.
- `supabase/config.toml` — add `[functions.bland-agent-webhook] verify_jwt = false`.

## 6. Secrets

Add **`BLAND_API_KEY`** (value provided in this message) via the secret tool before deploying functions.

## Acceptance
- Campaigns tab agent dropdown lists the 4 Bland agents.
- Picking a template auto-selects the corresponding Bland agent and pre-fills script.
- Launching a Bland-tagged campaign calls `bland-agent-trigger` → Bland places the call.
- Bland's post-call webhook updates `bland_leads.status` and writes a `bland_call_logs` row.
- A clear "Agent Webhook Directory" grid is visible at the very bottom of the Campaigns tab listing all 4 agents with their webhook URLs and active status.
