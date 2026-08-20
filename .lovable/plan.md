# business_leads — one table, business column, view per business

Findings first, because two of them change the shape you described.

## 1. Who touches `ut_partner_leads` today

46,000 rows. Readers and writers:

**Code — 9 src files, 6 edge functions.** Eight of those are WRITE paths:

| Path | Operation |
|---|---|
| `useUTPartnerLeads.ts` | insert, 3x update, delete |
| `useUTAIDialer.ts` | update |
| `UTLeadImporter.tsx` | insert (bulk) |
| `dc-bland-webhook` | update |
| `ut-geocode-backfill` | 2x update |

**Database — 6 views** (`dc_unified_leads`, `ut_category_demand`, `ut_city_demand`, `ut_territory_intelligence`, `ut_verified_event_halls`, `ut_verified_rental_companies`), **4 functions** (`ut_upsert_partner_lead` writes; `ut_calculate_ai_scores`, `ut_generate_recommendations`, `ut_get_lead_stats` read), and **6 foreign keys pointing in** from `ut_outreach_logs`, `ut_partner_profiles` (x2), `ut_partner_onboarding`, `ut_va_tasks`, plus a self-FK.

Two consequences:

- **The FKs are fine.** A rename carries constraints with it — they will point at `business_leads` automatically. This only works because the *table* keeps existing under a new name; it would have been fatal if we replaced the table.
- **The writers are the risk, and they are survivable.** A view over a single table with no computed columns is auto-updatable in Postgres, so insert/update/delete through `ut_partner_leads` keeps working — *except* that a mandatory `business` with no table default would make every insert through the view fail. Fix: the view carries `ALTER VIEW ... ALTER COLUMN business SET DEFAULT 'ut'` and `WITH CHECK OPTION`. Inserts through the compat view get `'ut'`; a write that tries to set another business through the UT view is rejected rather than silently misfiled. The base table still has **no** default — a direct insert with no business fails, which is the rule you wanted.

## 2. The 43,265 NULL `category_group` — do not build a filter on it

`category_group` is 94% empty. But `category` is NOT NULL and populated on every row:

| category | rows | of which category_group NULL |
|---|---|---|
| event_hall | 32,922 | 31,961 |
| rental_company | 11,561 | 10,761 |
| other | 506 | 506 |
| caterer | 354 | 37 |
| florist / security / photographer / staff / decorator / cleaner / bartender / event_planner / entertainer | 658 | 0 |

`category_group` was populated only for ~2,700 rows enriched by a later pass; the original 43k Places import never got one. The NULLs are not unclassified — they are event halls and rental companies with a known `category` and a missing rollup.

So: **backfill `category_group` deterministically from `category`** (event_hall→venue, rental_company→rental, and so on; `other`→NULL, 506 rows, genuinely unknown). After that the column is 99% populated and safe for Aldrin to filter on. Filtering on it today would drop 94% of the table.

## 3. The dedupe key — deliberate, as you called it

Today: `UNIQUE (external_place_id) WHERE duplicate_of IS NULL AND external_place_id IS NOT NULL`. One place_id, one row, globally.

Change to `UNIQUE (external_place_id, business) WHERE ...`. A limo company already in the table as a TopTier prospect becomes a **second row** when Brandaro scrapes it — same place_id, different business, different owner, different outreach state. Not a rejected duplicate. `ut_upsert_partner_lead` gets a `business` parameter and its `ON CONFLICT` target moves to the two-column predicate; called without one it raises rather than defaulting, same rule as the SMS class.

## 4. Suppression across every business

`isSuppressed()` takes a **phone number, not a lead** — it reads `dnc_list.phone_last10` and `opt_out_events.phone_last10`, both generated columns, and fails closed on lookup error. It is already business-blind: one number suppressed anywhere is suppressed everywhere. One table doesn't create that property, but five tables wouldn't have broken it either — what breaks it is a caller that skips the check.

So the guarantee gets moved into SQL rather than left to callers: each per-business view **anti-joins suppression on last-10** and does not emit suppressed leads at all. A view a VA queries cannot hand back a number that is on the list.

`dnc_list` currently holds 2 rows and neither matches a lead, so there is nothing to prove against today. Proof will be: pick a real lead phone, run it through the live opt-out write path (`handle_sms_opt_out`), then show that (a) the lead disappears from its business view and (b) `isSuppressed()` returns blocked for it — with the row shown before and after. Then remove the test suppression.

## 5. Category vocabulary

Add to the allowed `category` set: `limo`, `chauffeur`, `exotic_car`, `party_bus`, `yacht`, `nightclub`, `security_firm`, `authenticator`, `private_chef`, `photographer`, `beauty`.

Clean Google `place_type` mappings exist for: `night_club`→nightclub, `beauty_salon`/`hair_care`/`nail_salon`→beauty, `car_rental`→exotic_car (needs a name filter — most car_rental is Hertz), `spa`→beauty.

**No clean place type — text search required:** limo, chauffeur, party_bus, yacht, security_firm, authenticator, private_chef. Google returns these under generic types (`point_of_interest`, `establishment`, `travel_agency`, `moving_company`), so the runner must query by text ("limo service in {city}") and set the category from the query that found it, not from the returned types. That is recorded in the migration comment so a future runner doesn't try to derive it.

## What gets applied

1. `ALTER TABLE ut_partner_leads RENAME TO business_leads`.
2. `business text NOT NULL` — added nullable, backfilled to `'ut'` for all 46,000, then set NOT NULL, no default. CHECK against a known set.
3. `CREATE VIEW ut_partner_leads` = `business_leads WHERE business = 'ut'`, `WITH CHECK OPTION`, column default `'ut'`, grants matching today's. Every existing reader and writer keeps working unchanged.
4. `v_ut_supply`, `v_toptier_prospects`, `v_dynasty_prospects` — each filtered to its business, each suppression-anti-joined, each granted separately to `authenticated` (SELECT only). Registered in `public_view_contracts` per the standing rule.
5. Dedupe index swapped to `(external_place_id, business)`; `ut_upsert_partner_lead` takes a required `business`.
6. `category_group` backfilled from `category`; new TopTier categories added to the CHECK.
7. Suppression proof run and reported, then reverted.

Not touched: the 6 dependent views and 4 functions all reference the name `ut_partner_leads`, which still resolves — to the compat view for the views, and Postgres rewrites function bodies on rename where it can. Each one gets verified by execution after the migration, not assumed.
