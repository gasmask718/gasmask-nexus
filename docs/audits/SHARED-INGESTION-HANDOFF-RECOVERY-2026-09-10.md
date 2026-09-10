# Shared Ingestion Handoff Recovery — read-only audit (2026-09-10)

Scope: what actually exists of the "one shared search → normalize → dedupe → canonical
record → company eligibility/tags → business views" pipeline for Services.io, GIY,
TopTier (and Brandaro no-website eligibility). No code, DB, workflow or outreach changes
were made. Nothing was triggered.

## A. Environment and access

| Item | Value |
|---|---|
| Repository / project | this Lovable project (GasMask / Dynasty OS Nexus), branch `edit/edt-481d6be3-…` |
| Backend | Lovable Cloud project ref `qalaaroashbggynpvqct` (one instance serves preview + published) |
| Published app | https://gasmask-os-nexus.lovable.app |
| Recent commits | `11f97cb1 Reconciled master business list`, `fc0be43c Created full master document` — documentation only |

**This IS the right environment.** Services.io, GIY, Brandaro, TopTier, UT and Playboxxx
all live in this project's schema and routes. Nicole having "only the GasMask Lovable
project" is not a wrong-environment problem — it is the correct one.

Nicole still needs (names only, no values):
- Editor access to this Lovable project + its Cloud backend (she reports she has it).
- Workspace credits / plan headroom — she flagged a possible blocker; owner decision.
- If she is to run or read scrapers: knowledge of which secrets exist, not their values —
  `GOOGLE_MAPS_API_KEY`-class key used by `brandaro-lead-discovery`, `SCRAPER_INGEST_SECRET`
  (surplus funds scraper), `PLAYBOXXX_INGEST_SECRET` (recruiting). No shared-ingestion
  secret exists because no shared ingestion endpoint exists.
- Access to the Make.com org, if the intent is Make-driven runs. **UNVERIFIED** — no
  Make/n8n/Apify scenario for business-lead ingestion is referenced anywhere in the repo
  (the only Make integration in code is `playboxxx-recruiting-ingest`, a different domain).

## B. Requirement → evidence

| Requirement | Existing implementation | Evidence location | Status | Gap |
|---|---|---|---|---|
| Shared search/ingestion entry point for Svc/GIY/TopTier | **none** | no edge function, RPC or worker matches | MISSING | whole entry point |
| Search / provider integrations | exist, but per-domain: Google Places (`brandaro-lead-discovery`, `ingest-google-places`, `ut-places-search`), Overpass (`ingest-openstreetmap`, `overpass-discovery`), Yelp (`ingest-yelp`), Outscraper (`outscraper-webhook`) | `supabase/functions/*` | CODE PRESENT, per-business | not shared; each writes its own table |
| Normalization | only per-domain: `_shared/playboxxxLeadNormalize.ts` (recruiting), `_shared/icwCandidateDedupe.ts` (ICW) | `supabase/functions/_shared/` | PRESENT, wrong domain | no business-lead normalizer |
| Canonical record store | `public.business_leads` (one table, mandatory `business` column) | `docs/architecture/business-leads.md`; 297,010 rows: `ut` 297,003 / `playboxxx` 7 | PRESENT + POPULATED | only 2 businesses use it; no svc/giy/toptier rows |
| Dedupe / upsert rules | `ut_upsert_partner_lead(p jsonb)` requires `business`; unique `(external_place_id, business)`; `business_leads_ext_ref_unique` partial index | `docs/architecture/business-leads.md` §"Duplicate business case" (dated proof 2026-08-20) | VERIFIED for UT/Playboxxx | never exercised for svc/giy/toptier |
| Source / provenance | `external_source`, `external_place_id`, `source`, `search_term` on `business_leads` | ingest docs | PRESENT | no per-company run/provenance ledger |
| Company eligibility / business tags / routing | **none** — `business` is a single scalar, not a membership set; no eligibility table exists (`grant_eligibility_*` is Grant OS, unrelated) | information_schema scan | MISSING | the core of the shared design |
| Brandaro no-website eligibility | implemented as its **own scrape**, not as a filter over shared data: `brandaro-lead-discovery` calls Google Places, skips any lead with a real website, writes `has_website=false`, `website_status='no_website'` into Brandaro's own tables (`brandaro_leads_master`, `brandaro_clean_leads`, ~200 brandaro_* tables) | `supabase/functions/brandaro-lead-discovery/index.ts:139-305` | CODE PRESENT, contradicts intended design | must become a filter/view over canonical, not a parallel scrape |
| Services.io / GIY business views | UI + tables exist: `svc_leads`/`giy_leads` (+interactions/followups), `ProviderLeadsHub`, `/…/giy` leads queue | `supabase/migrations/20260904201259_*.sql`, `src/components/prohub/providerHubConfig.ts`, `src/pages/giy/GIYLeadsQueue.tsx` | CODE PRESENT, **0 rows each** | never fed by any ingestion; also modelled as *provider applications*, not scraped businesses |
| TopTier view | `v_toptier_prospects` (business-filtered, suppression anti-joined) | `docs/architecture/business-leads.md` | PRESENT | 0 toptier rows |
| Make/n8n scenarios, schedules | none for this pipeline | repo-wide search | MISSING / UNVERIFIED outside repo | needs owner confirmation |
| Arizona configuration / runs | no AZ pilot config anywhere. Only incidental data: 6,220 `business_leads` rows with `state='AZ'`, all `business='ut'`, newest 2026-08-26 | DB query | NO PILOT | AZ target categories undefined |
| Auth / business isolation | `business_leads` per-business views, SELECT-only to authenticated; but `svc_leads`/`giy_leads` policies are `FOR ALL TO authenticated USING (true)` — no isolation | migration `20260904201259` | WEAK | isolation needed before multi-company sharing |

Not evidence for this pipeline: Playboxxx recruiting ingest (people, not businesses),
ICW candidates, product sourcing, surplus-funds `scraper-ingest`/`promote-leads`
(county PDFs → `surplus_funds_leads`).

## C. Handoff recovery

Requested documents:

| Document | Result |
|---|---|
| `Unified_Ingestion_and_State_Rankings` (any variant) | **not present** in repo |
| `CHRISTOPHER_SHARED_INGESTION_HANDOFF` (any variant/rename) | **not present** in repo |
| `docs/architecture/business-leads.md` | **present**, dated 2026-08-20, with executed proofs |
| Arizona pilot requirements | **not present** |
| Michael/Christopher handoff notes, audits, progress reports | **none found**; no commit in visible history references either name or shared ingestion |

So: the only surviving written requirement for the shared layer is
`docs/architecture/business-leads.md`. It establishes the canonical table, the mandatory
`business` column, the `(external_place_id, business)` dedupe rule and per-business
suppression-filtered views — and it predates the Aug 27 assignment. **No implementation
attributable to Michael or Christopher can be established from this repo.** Nothing
suggests they deleted work either; there is simply no artefact. Treat the shared
search/eligibility layer as never started.

## D. Reuse / repair / build / blocked

**Reuse as-is (do not rebuild):**
- `public.business_leads` as the canonical store + its `business` column, `phone_last10`,
  provenance columns.
- `ut_upsert_partner_lead` dedupe semantics and the per-business view pattern
  (`v_ut_supply`, `v_toptier_prospects`, `v_dynasty_prospects`).
- Existing provider callers for search: Google Places / Overpass / Yelp code paths.
- `ProviderLeadsHub` + `providerHubConfig` for the Services.io / GIY surfaces.

**Repair:**
- `business` is scalar — a business found by two companies becomes two rows. The shared
  design needs company *membership/eligibility*, which is a design decision, not a bug fix.
- `brandaro-lead-discovery` should become the no-website **filter** over canonical data
  rather than its own Places scrape (owner approval required — it currently works).
- `svc_leads`/`giy_leads` RLS `USING (true)` gives no business isolation.
- Note the semantic clash: `svc_leads`/`giy_leads` are *provider applications*, while the
  shared pipeline produces *scraped businesses*. Decide whether they are the same surface.

**Build only if approved (genuinely absent):** shared ingestion entry point, business-lead
normalizer, eligibility/tag routing, Arizona pilot config, run/provenance logging, Make
scenario.

**Blocked / unverified:** Make.com scenarios and schedules (outside repo); the two missing
handoff documents; credits/plan headroom.

## E. Arizona starting point

- Documented target categories/geography for AZ: **none exist.** Do not invent quotas.
- Existing AZ data: 6,220 `business_leads` rows, all `business='ut'` (event halls /
  rental companies vocabulary), newest 2026-08-26. Zero AZ rows for svc/giy/toptier/brandaro.
- Smallest honest first step: define, in writing and approved by the owner, the AZ target
  category list per company (Services.io vs GIY vs TopTier) and the metro list — then run
  **one** category in **one** metro through the existing Places path and land it in
  `business_leads` with the correct `business`, using `ut_upsert_partner_lead`'s dedupe rule.
- Acceptance checks before any second state: (1) re-running the identical search inserts 0
  new rows and preserves the canonical record; (2) the same business found for two companies
  resolves per whatever eligibility rule is approved, verifiably; (3) rows appear in the
  intended business view and only that view; (4) no suppressed phone is visible in any view;
  (5) run counts logged with a run id.

## F. Copy-ready handoff for Nicole

> Environment is correct: the GasMask Lovable project *is* Dynasty OS Nexus — Services.io,
> GIY, TopTier and Brandaro all live there, backend included. Nothing was built for the
> shared ingestion pipeline; the earlier handoff docs are not in the repo, so start from
> what exists rather than looking for missing code.
>
> What already exists and must be reused, not rebuilt:
> - Canonical lead table `public.business_leads` (297k rows) with a mandatory `business`
>   column — spec in `docs/architecture/business-leads.md`.
> - Dedupe: `ut_upsert_partner_lead(p jsonb)`, unique on `(external_place_id, business)`.
> - Per-business views: `v_ut_supply`, `v_toptier_prospects`, `v_dynasty_prospects`.
> - Search callers: `supabase/functions/ingest-google-places`, `ingest-openstreetmap`,
>   `ingest-yelp`, `brandaro-lead-discovery`.
> - Business UIs: `src/components/prohub/ProviderLeadsHub.tsx` +
>   `providerHubConfig.ts` (`svc_leads`, `giy_leads` — both currently empty).
>
> What does not exist: a shared ingestion entry point, a business-lead normalizer, any
> company eligibility/tag routing, any Arizona configuration, and any Make scenario for
> this pipeline.
>
> First task (nothing else): write the Arizona pilot spec — target categories per company,
> metro list, and the eligibility rule for a business that qualifies for more than one
> company. No code, no scraping, no writes until that spec is approved.
>
> Expected evidence: a short spec document plus the exact existing table/function names she
> intends to reuse. Stopping point: stop at the spec. Do not create tables, do not run a
> scrape, do not enable any schedule or outreach.

## G. Owner decisions needed

1. Eligibility model: does one physical business become one canonical row with multiple
   company memberships, or one row per company (today's behaviour)? Everything downstream
   depends on this.
2. Are `svc_leads` / `giy_leads` (provider applications) the destination for scraped
   business leads, or a separate surface?
3. Approve or decline converting Brandaro's own discovery scrape into a filter over
   canonical data — it works today, so this is a deliberate trade.
4. Arizona target categories + metros per company (no documented criteria exist).
5. Confirm whether a Make.com org/scenario exists for this pipeline and grant Nicole access,
   or confirm it does not exist.
6. Workspace credits/plan headroom for Nicole.
