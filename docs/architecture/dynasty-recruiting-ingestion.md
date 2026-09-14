# Dynasty Recruiting Ingestion Foundation

**Status:** Canonical for cross-business staff recruiting. Added 2026-09-14.

## Why it exists

Staff specialty lists are a **recruiting ingestion taxonomy**, not a website category list:

```
staff category/role → recruitment ad → applicant intake → ingest → normalize/dedupe
→ tag (role + business + geography + campaign + platform) → call/review queue
→ qualification → onboarding
```

Before this, no shared applicant identity existed. Audited and left untouched:

| Existing system | Scope | Kept as-is |
|---|---|---|
| `hr_applicants` (+ `/hr/applicants`) | internal HR hiring, single `position`, no dedupe | yes |
| `icw_candidate_leads` | ICW cleaner sourcing | yes |
| `ambassador_applications` / `ambassador_leads` | ambassador recruitment | yes |
| `giy_leads` / `svc_leads` | provider signups | yes |
| `business_leads` | **businesses**, incl. Playboxxx creator sourcing | yes |
| `ut_staff_categories` / `ut_staff` | UT employment records | yes |

None of them is replaced or renamed. This layer sits above them.

## Tables

- `recruiting_categories` — 14 seeded parents: Specialty, Drivers, Chef, Security, Beauty / Massage, Event Staff, Night Clubs, Jewelers, Artist / Live Auction, Decorators / Florist, Camera Team, Wholesalers, Cleaners, Service Providers.
- `recruiting_roles` — detailed roles under a parent (`unique(category_id, slug)`), `requires_license` flag. Detailed party/event roles get added here later; no schema change needed.
- `recruiting_campaigns` — one recruitment ad / sourcing source: `code` (unique), platform, business, category/role, city/state, `external_ad_id`.
- `recruiting_applicants` — **canonical person**. `email_norm` and `phone_last10` are generated columns, each with a partial unique index. Carries `review_status`, `call_status`, `onboarding_status`.
- `recruiting_applications` — the many-to-many edge: applicant × category × role × business × campaign, plus source platform/ad id and raw `payload`. Unique dedupe index on that tuple.

RLS: owner/admin only on every table (`has_role`). Grants issued to `authenticated` + `service_role`.

## Intake

`public.ingest_recruiting_applicant(jsonb)` — SECURITY DEFINER, executable by `authenticated`/`service_role` (**not** `anon`).

Accepts: `full_name` (required), `email` and/or `phone` (at least one), `category_slug`/`category_id`, `role_slug`/`role_id`, `business_slug`, `campaign_code`/`campaign_id`, `source_platform`, `source_ad_id`, `city`, `state`, `country`, `experience_summary`, `qualifications`, `license_info`, `availability_summary`, `notes`.

Rules:
1. Match an existing person by normalized email, then by last-10 phone. Never create a second person.
2. On match, fill only blank fields — existing values are never overwritten.
3. Always attach an application row; re-submitting the identical role/business/campaign touches the existing row instead of duplicating.

Returns `{applicant_id, application_id, applicant_created, application_created}`.

## Admin surface

- View: `public.v_recruiting_applicant_queue` (security invoker) — one row per person with aggregated roles, categories, businesses, campaigns, platforms and application count.
- Page: `src/pages/os/recruiting/RecruitingApplicants.tsx` at `/os/recruiting/applicants` (`/os/recruiting` redirects there), owner/admin gated.
- Filters: search, parent category, exact role, business, campaign, state, review status. Inline pickers move review → call → onboarding status. "Add applicant" submits through the intake function, so manual entry is dedupe-safe too.

## Deliberately not built

- No automated outreach. Nothing in this layer calls, texts or emails anyone.
- No ad-generation system. The taxonomy + `recruiting_campaigns.code` is the linkage point for ads later.
- No public application form yet; `anon` cannot execute the intake function. Wiring a public form means adding a validated edge function, not granting `anon`.
