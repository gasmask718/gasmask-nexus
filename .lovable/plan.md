# Add `search_term` provenance to Playboxxx recruiting ingest

## Current state (verified)
- The webhook normalizer (`supabase/functions/_shared/playboxxxLeadNormalize.ts`) does not read `search_term`.
- `public.business_leads` has no column containing "search" (information_schema query returned 0 rows).
- Unknown payload fields are silently dropped by normalization, so Make.com payloads carrying `search_term` today arrive but the value is lost.

## Changes

### 1. Database migration
- `ALTER TABLE public.business_leads ADD COLUMN IF NOT EXISTS search_term text;` — nullable, no default, so all existing rows (Overpass/staff) stay NULL and unaffected.
- No grants/policies needed: column-level addition to an existing table.

### 2. Normalizer (`playboxxxLeadNormalize.ts`)
- Add `search_term: string | null` to `NormalizedLead`.
- Read `raw.search_term ?? raw.search ?? raw.query`, apply `cleanText(..., 200)` (trim, null-on-empty, 200-char cap). No other transformation — provenance should keep the original casing (e.g. "Miami Model").

### 3. Webhook function
- `playboxxx-recruiting-ingest/index.ts` inserts the whole normalized lead object, so no code change expected there; will confirm during implementation.

### 4. Documentation
- Update `docs/architecture/playboxxx-recruiting-ingest.md`: add `search_term` to the payload examples and the column-mapping table.

### 5. Verification
- Deploy `playboxxx-recruiting-ingest`.
- Test ingest of one creator payload with `search_term: "Miami Model"`; confirm the row in `business_leads` stores the value and report the inserted record ID.
- Confirm an Overpass-style payload without `search_term` still ingests (compatibility check).

## Out of scope
- No changes to role mappings, dedupe keys, Instagram fields, or any other recruiting/OS functionality.
