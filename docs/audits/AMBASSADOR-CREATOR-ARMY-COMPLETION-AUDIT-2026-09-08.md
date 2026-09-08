# Ambassador / Creator Army — Completion Audit (read-only)

Date: 2026-09-08. No code, data, routes, config, credentials, outreach, or integrations were changed.

**Scope-source note:** `ambassador-creator-army-master-scope.md` does not exist in the repo, `docs/`, or `/mnt/user-uploads/`. Comparison was made against the role/scope definitions supplied in the request. All findings below come from live DB queries, code reads, secret-name listing, and an authenticated browser load — not from docs or prior status messages.

---

## AMBASSADOR SYSTEM COMPLETION %

**~55%** overall for the Ambassador workstream; **~20%** for the wider "Creator Army" (Clippers / Paid Creators / Media Network) once sourcing and outreach are included.

Weighted: accounts/assignments/routes/maps are real and live (largely done); creator sourcing, discovery APIs, candidate pool, and outreach are effectively not built.

---

## ACCOUNTS / ASSIGNMENTS / ROUTES — **PARTIAL (working, under-populated)**

Live evidence:

| Item | Live value |
|---|---|
| `ambassadors` | 79 rows, 78 active (`is_active`, not `active`) |
| Active ambassadors missing `user_id` (login) | 10 |
| `ambassador_assignments` | 17 rows, 8 active store assignments |
| Duplicate active (ambassador, store) groups | 0 |
| Duplicate prevention | `uq_ambassador_assignments_active_store` unique partial index present |
| `routes` | 48 (14 active, 8 scheduled, 8 pending, 8 completed, 5 planned, 3 in_progress, 1 paused, 1 cancelled) |
| Routes with an assignee | 9 — all 9 map to ambassadors with logins |
| `route_stops` | 96; 96 resolve to a real store; 84 have lat/lng |
| Completed stops | **0** — no ambassador has yet worked a stop end-to-end |
| `ambassador_leads` / `ambassador_applications` / `ambassador_role_data` | 0 / 0 / 0 |

Manager UI is live: `/ambassadors/assignments` → `src/pages/floor8/AmbassadorAssignmentsPage.tsx`, registered at `AppRoutes.tsx:1850` and in `Layout.tsx:385`. Authenticated load renders real counts (78 active / 10 missing login / 8 active assignments / 52 with a route) and a real roster with login badges and route status.

Canonical-only: the page joins `ambassadors`, `ambassador_assignments`, `store_master`, `stores`, `routes`, `route_stops`. No second roster, assignment table, or routing system was found.

Gaps: 10 active ambassadors have no login (cannot see their route); 12 route stops lack coordinates; 0 stops ever completed, so the stop-progress loop is built but unproven by real field use; `ambassador_applications` is empty so there is no intake→roster path in use.

---

## PROFILE MAP — **PASS (with one real blur cause)**

- Provider/API: **Google Maps JavaScript API** (vector) for `StoreLocationMap.tsx`, **Google Street View panorama** for `StoreStreetView.tsx`. Browser key fetched at runtime from edge function `get-maps-browser-key`; no hardcoded key. `GOOGLE_MAPS_BROWSER_KEY`, `GOOGLE_STREETVIEW_API_KEY`, `GOOGLE_PLACES_API_KEY` all present as secrets.
- Blur/root cause: **not token, domain, or environment.** The interactive map and panorama are vector and sharp. The blur is the *fallback* path only: when no Street View panorama exists for a coordinate, `StoreStreetView.tsx:157-172` renders `<img src=".../functions/v1/street-view-image?...&w=800&h=260">`, and `supabase/functions/street-view-image/index.ts` calls Google's **Street View Static API** with `size=WxH` and **no `scale=2` / `@2x` parameter**. On any DPR≥2 display that raster is upscaled → soft/"development-looking".
- Fix (one line each): pass `scale=2` through the edge function and request `w`/`h` at logical size, or hide the fallback image when no panorama exists.

## AMBASSADOR LOGIN MAP — **PASS**

- Provider/API: **Mapbox GL JS vector** — `AmbassadorStoreMap.tsx` → `GeoMapView.tsx:236-244`, style `mapbox://styles/mapbox/dark-v11`, token `import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN` (present in `.env`; `MAPBOX_PUBLIC_TOKEN` also present as an edge secret). `GeoMapView` has **no** hardcoded fallback token and fails loudly if unset.
- Blur/root cause: **none in this path.** mapbox-gl renders at `devicePixelRatio` automatically; there is no static raster, no `staticmap` URL, and no iframe embed anywhere in the ambassador map path (`rg "staticmap|@2x"` → 0 matches in `src`).
- Pins/routes are real: coordinates come from `stores.lat/lng` and stops from `route_stops`. `rg -i "mock|demo|sample"` over `AmbassadorStoreMap.tsx`, `AmbassadorRoutes.tsx`, `AmbassadorAssignmentsPage.tsx`, `GeoMapView.tsx` → **0 matches**. Stores without coordinates are listed as needing geocoding, never given invented lat/lng.
- Note: other, unrelated components (`BikerLocationPreview.tsx:9`, `Territories.tsx:11`) do hardcode the project's real Mapbox pk token as a fallback — a hygiene issue, not a blur cause.

---

## Role-by-role (kept separate, per scope)

| Capability | Ambassadors | Clippers | Paid Creators | Media Network videographers |
|---|---|---|---|---|
| DB model | YES (`ambassadors`, assignments, portfolio, routes) | YES (`clipper_accounts` 4, `campaigns` 8, `submissions` 1, `assignments` 1) | PARTIAL (`influencers` 15, campaigns 3, posts 2, conversions 2) | Model only (`media_creators` 0, `media_creator_applications` 0) |
| Application/intake | `/apply/ambassador` (0 rows in `ambassador_applications`) | `/apply` + `/apply/clipper` (4 applications) | none dedicated | **none** |
| Roster | 79 (78 active) | 4 | 15 | 0 |
| Discovery pipeline | NO | NO | NO | NO |
| Outreach templates | `ambassador_message_templates` = 0 | NO | NO | NO |
| Outreach enabled | **NO** (all switches off) | NO | NO | NO |
| Referral/commission tracking | tables exist, near-empty (`ambassador_purchases` 2, `affiliate_clicks`/`conversions` 0, `ambassador_online_sales` 0) | `clipper_earnings` 0, `clipper_payouts` 0 | `influencer_conversions` 2, `tracking_links` 0 | none |
| Dashboard/login | YES (`/ambassadors/*` + portal) | YES (`/clipper/login`, `/clipper/portal`, `/os/clipper-nation/*`) | partial admin views | NO |

Roles are not blended in the data model — that part of the scope holds.

---

## YOUTUBE SOURCING — **NOT BUILT; claimed count contradicted**

- No YouTube API credential exists (secret list has no `YOUTUBE_*`). No API client, no edge function, no scheduler.
- Only manual handle fields (`SocialIdentitySection.tsx:66-72`) and a fake sync TODO (`InfluencerSocialAccounts.tsx:64-71`).
- Live "544 creators": **false.** The only YouTube-tagged data is `business_leads` with `source='youtube'` → **139 rows**, 139 distinct external IDs, all created 2026-08-26, all status `new`, 0 emails, 1 phone, 0 URLs, categories 117 entertainer / 12 caterer / 10 other. They sit in the generic business CRM table, not any creator/ambassador candidate table, and are unusable for outreach (no contact info).

## TIKTOK — **NOT STARTED**

No developer app, no products/scopes, no Content Posting API, no Research API, no secrets, no code, no data. Only manual handle fields (`SocialIdentitySection.tsx:55-65`, `receive-ut-ambassador/index.ts:21`, `receive-ut-staff/index.ts:28`).

## INSTAGRAM / FACEBOOK — **NOT STARTED (Meta); indirect scraper only**

No Meta app, no Graph API call, no OAuth/account-authorization flow, no Meta secrets, no analytics code. The only Instagram touchpoint is indirect hashtag discovery via **PhantomBuster** in `ut-lead-scraper/index.ts:90-114` writing to `ut_leads` — and `PHANTOMBUSTER_API_KEY` / `PHANTOMBUSTER_AGENT_ID` are **not in the secret list**, so that branch cannot run today. `ut_leads` = 0 rows.

## REDDIT — **NOT STARTED**

Zero references in `src/` or `supabase/functions/`; no secret, no attempt found in code.

## ONLINEJOBS.PH — **MANUAL (not blocked system work)**

Zero code, zero credentials, zero tables. Label it a manual sourcing channel; nothing is half-built.

## Other discovery sources present

- Outscraper — `OUTSCRAPER_API_KEY` **is** configured, used in `ut-lead-scraper` (on-demand, not scheduled).
- Apollo — referenced in `ut-lead-scraper`; `APOLLO_API_KEY` **not** configured.
- "Apify / Approved Social Discovery" in Playboxxx recruiting is a **label over a hardcoded `MOCK_CREATORS` array** (`recruiting/shared.tsx`, `CreatorSourcing.tsx`) — no Apify integration.
- SerpAPI is used for Dynasty Direct product sourcing only, not creator discovery.
- No platform-specific creator cron in `supabase/config.toml` or migrations.

---

## CREATOR CANDIDATE POOL

There is **no canonical creator-candidate table in use.**

| Table | Rows | Readiness |
|---|---|---|
| `business_leads` (source=youtube) | 139 | discovered only; 0 emails, 1 phone; not creator-scoped |
| `ut_ambassador_prospects` | 0 | scoring function exists, no data |
| `ambassador_leads` | 0 | — |
| `ambassador_applications` | 0 | — |
| `ut_leads` | 0 | — |
| `media_creators` / `media_creator_applications` | 0 / 0 | — |
| `influencers` | 15 | existing roster, not candidates |
| `clipper_applications` | 4 | reviewed/approved path exists (4 accounts) |

Funnel state: **discovered = 139 (weak, contact-less) → reviewed/graded = 0 → approved = 0 → outreach-ready = 0 → contacted = 0 → ambassador account = 0 from sourcing.** All 79 ambassadors came from manual/legacy entry, not from a discovery pipeline.

## OUTREACH CURRENTLY ACTIVE — **NO**

`outreach_switches`: 16 rows, **0 enabled**. `outreach_allowed()` gate is implemented in `supabase/functions/_shared/outreachGate.ts` and defaults closed. No outreach was sent during this audit.

---

## WHAT IS ACTUALLY COMPLETE

- Canonical ambassador roster, assignments, portfolio, routes, route_stops — single system, no duplicates.
- Manager Assignments & Routes UI live at `/ambassadors/assignments`, rendering real data.
- Duplicate active-assignment prevention enforced at the DB level.
- Ambassador-side assigned stores, addresses, ordered stops, real map pins, geocoding flags.
- Both maps functional with valid provider config (Google on store profile, Mapbox in portal).
- Clipper role: application → account → campaign → submission chain exists with real (small) data.
- Fail-closed outreach gating.

## WHAT WAS LEFT MIDWAY

- 10 active ambassadors with no login.
- 12 route stops without coordinates; 0 stops ever completed.
- `ut-ambassador-finder` scores prospects but nothing populates `ut_ambassador_prospects` — a scorer with no feeder.
- `ut-lead-scraper` references Apollo/PhantomBuster whose keys are absent — dead branches.
- Playboxxx creator sourcing UI ships mock data behind a real-looking "Apify" label.
- Commission/referral tables exist but are unwired in practice (0 clicks, 0 conversions, 0 tracking links, 0 payouts).
- Media Network videographer role: tables only, no intake, no roster, no UI.

## QUICK WINS WE CAN CLOSE NOW

1. Add `scale=2` to `street-view-image` — removes the blurry map complaint outright.
2. Geocode the 12 coordinate-less route stops (flagging already exists).
3. Create logins for the 10 active ambassadors, or mark them inactive.
4. Relabel Playboxxx "Apify / Approved Social Discovery" as demo data so it stops reading as a live pipeline.
5. Remove the hardcoded Mapbox token fallbacks in `BikerLocationPreview.tsx` / `Territories.tsx`.
6. Decide the canonical creator-candidate table before any sourcing is built (today's 139 YouTube rows are in the wrong table).

## TRUE EXTERNAL BLOCKERS

- YouTube Data API key — not obtained.
- TikTok developer app + Research/Content Posting API approval — not applied for. Research API requires an approved application; this is weeks of external lead time.
- Meta developer app, review, and scopes — not started. Note: Meta Graph gives **analytics for connected accounts**, not open creator discovery; it cannot fulfil a discovery scope.
- Apollo and PhantomBuster keys absent (billing/account decision).
- OnlineJobs.ph has no public automation API — manual by nature.
- Owner/compliance decision required before any switch in `outreach_switches` is flipped on.

## SMALLEST PATH TO FINISH

1. Fix Street View `scale=2`; geocode 12 stops; issue the 10 missing logins. (Ambassador ops then genuinely complete — one real ambassador working one real route to a completed stop is the proof.)
2. Pick one canonical `creator_candidates` table with provenance + contact + status columns spanning discovered → reviewed → approved → outreach-ready → contacted → account.
3. Obtain a YouTube Data API key (cheapest, fastest, no approval queue) and build one scheduled sourcing function writing into that table with source tags. Treat TikTok/Meta as later phases gated on external approval.
4. Add Clipper/Paid-Creator/Videographer intake pages mirroring `/apply/ambassador`, keeping pay models separate.
5. Route outreach through the existing generic recruiting/outreach gate — do not build a second sender. Keep switches off until pre-flight and an application round-trip test pass.

## SCOPE ACCURACY FLAGS

- Implemented: roster, assignments, routes/stops, maps, duplicate prevention, clipper chain, outreach gating.
- Partially implemented: ambassador route execution (no completions), influencer/paid-creator model, commission tracking.
- Documented only: creator sourcing pipeline, multi-platform discovery, videographer network.
- Stale / contradicted by live data: "544 sourced creators" (live: 139 contact-less `business_leads`); "Apify social discovery" (mock array); PhantomBuster/Apollo sourcing (keys absent, `ut_leads` = 0).
- Owner/compliance dependent: enabling any outreach switch; TikTok/Meta app submissions; commission rates (not modeled anywhere — documented only).
