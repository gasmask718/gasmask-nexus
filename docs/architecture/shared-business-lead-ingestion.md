# Shared business lead ingestion (Services.io / Goddess In You / Brandaro)

Established 2026-09-14. Ingestion + normalization + dedupe + eligibility only. **No outreach.**

## Why a second identity model exists

`public.business_leads` historically partitions by the mandatory `business` column:
the unique key is `(external_place_id, business)`, so the same place under two brands
is deliberately two rows (UT vs Playboxxx). That doctrine is unchanged for the 297,017
existing `ut` / `playboxxx` rows.

For the Dynasty shared pool the requirement is the opposite: **one canonical business,
many company eligibilities**. That pool lives in the same table under `business = 'shared'`
and is the only lane with cross-company dedupe.

## Canonical record

Same table, columns added (all nullable, no behaviour change for existing lanes):
`street_address`, `zip`, `country`, `source_url`, `source_record_id`, `ingestion_run_id`,
plus generated `name_norm`, `addr_norm`, `website_domain`.

Normalisers (IMMUTABLE): `bl_norm_name()`, `bl_norm_addr()`, `bl_domain()`.
Category is mapped onto the existing canonical vocabulary by `bl_canonical_category()`;
the raw source value is preserved in `category_original`.

## Dedupe order (strongest identifier first)

1. `(external_source, source_record_id)`
2. `phone_last10`
3. `website_domain`
4. `name_norm + addr_norm`

Enforced both procedurally in `ingest_business_lead(p jsonb)` and structurally by three
partial unique indexes scoped to `business = 'shared'`. Re-running a source updates and
increments `times_seen`; it never creates a second canonical row.

`ingest_business_lead` is SECURITY DEFINER, service_role only, and returns
`{lead_id, action: inserted|deduped, matched_on}`.

## Eligibility

`public.business_lead_eligibility (lead_id, company, eligible, reason, rule)`, unique on
`(lead_id, company)`. A business qualifying for several companies stays ONE row in
`business_leads`.

- `rule = 'explicit'` — company passed in the ingest payload's `companies` array.
- `rule = 'brandaro.no_website'` — computed by `apply_business_lead_eligibility(lead_id)`:
  eligible while `website_domain IS NULL`, flipped to `eligible = false` when a website appears.

There is **no Brandaro-specific scraper**; "no website" is a filter on the shared pool.

## Run provenance

`public.lead_ingestion_runs` — source, query_term, geography, category, companies,
started/completed, outcome, raw/inserted/updated/deduped/skipped counts, error_detail.
Leads point back via `business_leads.ingestion_run_id`.

## Company queues

- `v_services_io_business_leads`
- `v_goddess_in_you_business_leads`
- `v_brandaro_business_leads` (additionally requires `website_domain IS NULL`)

All three join the same canonical row and anti-join `dnc_list` + `opt_out_events` on
`phone_last10`, matching the existing `v_toptier_prospects` / `v_dynasty_prospects` pattern.
Granted to `authenticated` only (no anon).

## Not part of this

`svc_leads` / `giy_leads` + `ProviderLeadsHub` / `providerHubConfig` are **provider
applicant** records (people applying), a different entity from scraped businesses. They
were audited and left untouched.

## Pending owner configuration

No approved Arizona (or any) pilot config exists in the project: no metro/category list
is defined for Services.io or Goddess In You. Until the owner supplies one, those two
companies only receive eligibility passed explicitly per ingest call. Broad ingestion is
therefore not started.
