# BWB-10 Piece 4 — Paid Builds Pipeline

## Recommended placement (answer to your question)

**Put the spec's pipeline card directly on `/brandaro/builder`, and keep `BuildPipelinePage` as-is with a link out to it.**

Reasoning:
- The spec's Paid Builds Pipeline is a 5-column operator summary (Business | Tier | Amount | Status | Actions). `BuildPipelinePage` is a different thing: a deep engine-health view with queue/in-progress/completed/failed buckets, avg build time, success rate, engine switching, retry counts, and 11 internal build statuses.
- Embedding the whole `BuildPipelinePage` inside `/brandaro/builder` would drown the spec's four stat cards and demos table in engine telemetry.
- Duplicating the deep view would create two places to maintain the same query.

So: a self-contained `PaidBuildsPipeline` card on `/brandaro/builder`, plus a "Full build pipeline" link to the existing route. The three audit gaps get fixed inside the new card; `BuildPipelinePage` is left untouched this pass.

## Data (verified against live schema)

`brandaro_build_jobs` already has `demo_id` and `lead_id` (both populated on the one existing row) — no migration needed for the join.

- **Business name**: `brandaro_demo_sites.business_name` via `demo_id`, falling back to `brandaro_qualified_leads.business_name` via `lead_id`, then `Build #<id-slice>`.
- **Tier**: `brandaro_build_jobs.package_tier`, falling back to `brandaro_demo_sites.paid_tier`.
- **Amount**: `brandaro_demo_sites.paid_amount` via `demo_id`, rendered as currency, `—` when null.
- **Status**: `brandaro_build_jobs.build_status`.

Single query with two PostgREST embeds:

```text
brandaro_build_jobs
  select id, build_status, package_tier, demo_id, lead_id, deployed_url, created_at,
         brandaro_demo_sites!demo_id ( business_name, paid_amount, paid_tier ),
         brandaro_qualified_leads!lead_id ( business_name )
  order by created_at desc
```

If PostgREST cannot resolve the embed hints (no declared FK), fall back to two follow-up `in()` lookups keyed by the collected `demo_id` / `lead_id` sets and stitch client-side. Verified before shipping.

## Update Status dropdown

Exactly the four spec statuses, in order: `intake_sent` -> `building` -> `review` -> `live`.

- Rendered as a shadcn `Select` per row in the Actions cell.
- On change: `update brandaro_build_jobs set build_status = <value>` for that id, then `invalidateQueries` and a success toast. Raw error surfaced on failure, spinner on the row while pending.
- `build_status` is free text, so no enum migration is required.
- Rows already carrying a legacy engine status (`queued`, `failed`, `completed`, etc.) show that value as the current label; picking one of the four spec statuses overwrites it. Legacy values are not added to the dropdown.
- Retry button from `BuildPipelinePage` is not carried over — spec says Actions is the status dropdown. The retry path stays available on the full pipeline page.

## Files

- New: `src/components/brandaro/PaidBuildsPipeline.tsx` — query, table, status mutation.
- Edit: `src/pages/brandaro/BuilderHubPage.tsx` — mount the card below the demos tabs, with the link to `/brandaro/build-pipeline`.
- Unchanged: `src/pages/brandaro/BuildPipelinePage.tsx`.

## Notes

- Only one build job exists today (`TEST - David Suth`, starter, $499, status `failed`), so the empty/near-empty state matters: explicit "No paid builds yet" row.
- Money formatted via the existing currency conventions, no hardcoded colors — status badge tones use semantic tokens.
