# Dynasty Creators & Ambassadors — All Businesses Master Scope

Prepared 2026-09-10 (UTC). Documentation only — **no application code, database table, route, campaign, credential or outreach was created or changed by this task.**

Audience: Gerson (Apify + Make recruiting/search automation), reviewed by Ching.

---

## 1. Purpose

One operating document that tells Gerson, per Dynasty business:

- whether a recruiting lane exists at all,
- which *kind* of person that lane recruits (ambassador ≠ creator ≠ clipper ≠ affiliate ≠ field ambassador ≠ operator),
- whether candidates may be **sourced** today,
- whether anyone may be **contacted** today (default: no),
- and what data each discovered candidate must carry.

This generalises the Playboxxx work already shipped without discarding it and without pretending a recruiting program exists where none has been defined.

---

## 2. Source of Truth

### 2.1 Business list — RECONCILED 2026-09-10

The **"Dynasty OS — State of the Empire"** document (*snapshot compiled September 8, 2026*) was received on 2026-09-10 and is now the **canonical business list**. §4 has been reconciled against it line-for-line.

Reconciliation rules applied:

- Every venture named in State of the Empire (SOE) appears in §4, including the ones with no recruiting lane — those are listed as `NOT APPLICABLE` rather than omitted.
- Where SOE and an in-repo audit disagree on *status*, **SOE sets the venture's headline status** and the audit keeps the operational detail. Both are shown.
- Recruiting-lane judgements were **not** changed by SOE unless SOE states a fact that contradicts them (noted in the Notes column).
- Ventures in §4 that SOE does **not** list are retained and flagged `NOT IN SOE` — they are open questions for Ching (§16), not deletions.

The secondary sources (hubs registered in the running OS — `src/components/Layout.tsx`, `src/config/dynastyBrands.ts`, `src/config/brands.ts`) remain in use for anything SOE does not describe.

### 2.2 Status/evidence sources (all in-repo, all read-only)

| Source | Used for |
|---|---|
| `docs/audits/AMBASSADOR-CREATOR-ARMY-COMPLETION-AUDIT-2026-09-08.md` | ambassador/creator/clipper/paid-creator real state, sourcing reality |
| `docs/audits/ICW-AND-RECRUITING-COMPLETION-AUDIT-2026-09-08.md` | ICW state, generic recruiting system state, UT growth engine |
| `docs/architecture/playboxxx-recruiting-ingest.md` | the one working ingest contract |
| `docs/audits/DYNASTY_CLIPPER_NATION_OS_FLOOR_AUDIT.md` | clipper program state, payout readiness, access gap |
| `docs/architecture/business-leads.md` | shared lead table, `business` column, per-business views, suppression |
| `docs/audits/UNFORGETTABLE_TIMES_OS_HUB_AUDIT*.md`, `DYNASTY_FUNDING_HUB_AUDIT.md`, `DYNASTY_DIRECT_OS_HUB_*`, `UBEN_OS_HUB_AUDIT.md`, `SURPLUS-*`, `dynasty-connect-*` | per-hub operational status |
| `roadmap.md` | open blockers |

Where a status could not be evidenced from these, this document says **UNVERIFIED** rather than guessing.

---

## 3. Role Definitions

| Lane | Who they are | Paid for | Existing system in OS |
|---|---|---|---|
| **Ambassador** | Named person on a roster, assigned to stores/routes/accounts, works a territory | activity + referral/commission | `ambassadors`, `ambassador_assignments`, `ambassador_store_portfolio`, `routes`, `route_stops`, `/ambassadors/*` |
| **Field Ambassador / Verification Crew** | Physically visits stores (bikers, store acquisition, verification) | per visit / route | same ambassador tables + `field-verification` hub, driver/biker portals |
| **Creator / Content Creator** | Produces original content for a brand | flat, per-post, or gifting | `influencers` (15 rows), influencer portal, `media_creators` (model only, 0 rows) |
| **Clipper** | Edits/reposts supplied footage at volume | per 1k views + commission | `clipper_accounts/campaigns/submissions/earnings/payouts`, `/os/clipper-nation/*` |
| **Affiliate** | Sends traffic/leads via a link or code, no content obligation | commission on conversion | `affiliate_clicks`, `affiliate_conversions`, `tracking_links` — all 0 rows, unwired |
| **Partner / Operator** | A business or licensed individual delivering the service locally | revenue share / job price | ICW `icw_workers`, UT supplier triad, TopTier partners, Services.io providers |

These are **not** interchangeable. The data model keeps them separate today and this document keeps them separate.

---

## 4. Full Business Recruiting Matrix

Activation Status: `ACTIVE` · `READY TO SOURCE` · `PREP ONLY` · `BLOCKED` · `NOT APPLICABLE`.
Outreach is **OFF** everywhere unless a row says otherwise — `outreach_switches` has 16 rows and **0 enabled**, and `outreach_allowed()` fails closed.

| # | Business | Current Status (evidenced) | Recruiting Lane | Target Person | Primary Goal | Channel / Search Source | Activation | Outreach | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **GasMask / Grabba R Us / Hot Mama / Hotscolatti** (ONE operating company, 4 brands) | Operating; 2,145-store prospect universe, 438 active | Field Ambassador · Ambassador (store acquisition) | NYC-metro field reps, bikers | Store visits, orders, verification | Manual/roster; store book, not social scraping | ACTIVE (roster) / PREP ONLY (sourcing) | OFF | 79 ambassadors, 78 active, but **0 route stops ever completed**, 76 records login-required after shared-login unlink. Fix logins before adding people. |
| 2 | **GasMask / Grabba — local brand content** | No program defined in any doc | Creator (local/lifestyle) | Brooklyn/NYC lifestyle + smoke-culture creators | Brand content, UGC | Apify IG/TikTok by geo + hashtag | PREP ONLY | OFF | Category/compliance review needed (tobacco-adjacent brands, platform ad rules). No campaign, no budget, no rate documented. |
| 3 | **GasMask Clothing** (separate apparel lane) | SOE: 🟢 LIVE / EARNING — launched, fulfilling orders, small real customer base; no recruiting doc found | Creator (streetwear/UGC) · Affiliate | Streetwear/fashion creators, micro-UGC | Launch content, affiliate sales | Apify IG/TikTok fashion + geo | PREP ONLY | OFF | Affiliate infrastructure exists but is unwired (0 clicks, 0 conversions, 0 tracking links). Sourcing a pool is safe; paying anyone is not yet possible. |
| 4 | **GasMask Field Verification Crew** | `field-verification` hub live | Field Ambassador | Local verifiers/bikers | Photo-proof store checks | Local/manual, referrals | ACTIVE | OFF | Operational field role. **Never merge into the online Creator Army lists.** |
| 5 | **Playboxxx / NightWorld** | SOE: ⚪ EARLY / CONCEPT (adult creator marketplace, Mux streaming built, A2P deferred — carrier restrictions on adult content). Recruiting ingest webhook live and proven | Creator (adult) · Staff/Operator | Adult & nightlife creators; event staff (beauty, chef, cleaner, decorator, florist, staff) | Platform supply | **Apify → Make → `playboxxx-recruiting-ingest`** (Instagram + Overpass) | READY TO SOURCE | OFF | The one working pipeline. Roles accepted: model, creator, photographer, cameraman, videographer + staff lanes. IG fields + `search_term` provenance supported. **Adult sourcing stays segmented — never merged into general-market campaigns.** Carrier/platform restrictions apply to any future SMS/DM. |
| 6 | **Unforgettable Times (UT)** | SOE: 🟡 BUILT, NOT WORKING — **0 of 5 core journeys work end-to-end, 0 bookings, 0 payouts ever**; no vendor has completed onboarding. 5 `ut_campaigns` marked active with **0 leads behind them** | Ambassador · Creator (events) · Partner (suppliers) | Party/event creators, venue partners, event staff | Bookings, supply | `business_leads` (297k UT rows), `ut-lead-scraper`, Apify events/venues | READY TO SOURCE (pool only) | OFF | **Known defect: ambassador commission/accumulated-totals is wrong** (`docs/architecture/known-issues-accumulated-ambassador-totals.md`). Do not represent payment as operational. |
| 7 | **TopTier Experience** | SOE: 🟡 BUILT, NOT WORKING — public site live but dispatch cascade **hard-fails** (queries `partners`, `tt_service_partners`, `vehicles`, none resolve) | Partner / Operator | Limo, exotic car, yacht, heli, photographer partners | Fulfilment capacity | `v_toptier_prospects` (per-business view of `business_leads`) | PREP ONLY | OFF | Do not mass-recruit into a dispatch path with unresolved blockers. Supply pool building is acceptable; onboarding promises are not. |
| 8 | **Dynasty Direct** | Storefront + wholesaler portal live; **checkout/money-path defects documented** (`docs/dynasty-direct/…`, DD audit 2026-08-24) | Affiliate · Creator (product UGC) · Reseller | Product reviewers, resellers | Sales | Apify IG/TikTok product niches | PREP ONLY | OFF | Conversion is blocked — sourcing a pool is fine, recruiting sellers into a broken checkout is not. |
| 9 | **Dynasty Funding Hub** | Hub live; documented as ready to route ambassadors in | **Ambassador (referral)** | Referral partners, credit/biz-finance educators | Funded applications | Manual + targeted creator search | READY TO SOURCE | OFF until owner approves | Highest-priority ambassador lane **if** Ching confirms the referral terms. **No commission rate is modelled anywhere** — none is invented here. |
| 10 | **Dynasty Credit Shield** | SOE: 🟢 LIVE / EARNING — active client casework, disputes in motion. No referral/affiliate program found in docs | None yet (evaluate) | — | — | — | PREP ONLY | OFF | Do **not** auto-activate influencer outreach. Requires an owner decision that a referral lane exists at all. |
| 11 | **Dynasty Recovery Group / Surplus Funds** | 50-state scope + completion map exist; licensing-gated | Affiliate / lead referral (separate from casework) | Lead referrers only | Case leads | Manual, state-by-state | BLOCKED (regulated) | OFF | Referral lane must be evaluated **separately** from regulated casework. No outreach in licensing-gated states. |
| 12 | **Highway** (standalone cannabis delivery app) | SOE: 🟠 MID-BUILD — brand + architecture locked, ingestion of licensed operators underway, stalled on credits. Hub + hub map built | Partner / Operator (later) | Carriers/operators | Supply | — | BLOCKED | OFF | No uncontrolled creator/ambassador outreach while legal + operator ingestion is incomplete. |
| 13 | **I Clean We Clean (ICW)** | ~45% complete; 0 workers, 0 jobs, licensing gate inert, intake is a stub | Partner / Operator (cleaners) · Local Creator (later) | Local cleaners/handymen; service-provider businesses | Worker supply | `icw_sourced_leads` (47), `icw_candidate_leads` (7), `/apply/cleaner`, care.com/craigslist | READY TO SOURCE (workers only) | OFF | 7 applicants are stranded with no review UI. Licensing gate columns are NULL — nothing can be blocked today. Attorney review outstanding. |
| 14 | **Brandaro Digital (AI Receptionist SaaS)** | SOE: 🔵 BUILT, AWAITING LAUNCH — product ($497 setup + $197/mo) built on Retell + Twilio, **zero customers, zero calls**; blocked on A2P 10DLC + first customer. Named the near-term cash engine (Track A). VA/receptionist + site-builder operations live | Affiliate / referral partner (only lane with any doc support) | Referral partners, B2B setters | Client acquisition | Manual/B2B, not creator scraping | PREP ONLY | OFF | B2B creators and appointment setters are **not** documented — listed as candidates for an owner decision, not as an active lane. |
| 15 | **Dynasty Clipper Nation** | Operator console ~75% built; 2–4 clippers, 8 campaigns, 0 submissions, 0 payouts | **Clipper** | Short-form editors/reposters | Volume views for Dynasty brands | Apify TikTok/IG/YT clip accounts | READY TO SOURCE | OFF | Payouts: Wise/PayPal still on **sandbox** URLs; no application-intake table; routes not admin-gated. Build the pool, do not promise payment. |
| 16 | **UBEN (non-profit)** | SOE: ⚪ EARLY / CONCEPT — nonprofit shell with ambassador tracking built, grant-strategy stage. Hub + ambassador/affiliate tier docs exist (Bronze→Platinum, override commissions) | Ambassador · Affiliate | Community ambassadors | Impact + fundraising | Manual/community | PREP ONLY | OFF | Retain existing tier documentation as-is; it is the only tiered commission structure already written down. |
| 17 | **Dynasty Earn** | **NOT IN SOE** — hub exists in the OS (`dynasty-earn`) but the canonical list does not name it | Affiliate (UNVERIFIED) | — | — | — | PREP ONLY | OFF | Program definition not evidenced in docs and not confirmed by SOE. Owner decision — is this a live venture or a dead hub? |
| 18 | **Goddess In You** | SOE: 🟠 MID-BUILD — luxury mobile beauty JV with Sara, forked from TopTier codebase; 60/40 split, vesting and non-compete **scoped but not yet discussed with her** | None yet | — | — | — | BLOCKED | OFF | SOE confirms terms are not agreed. Do not activate recruiting that assumes finalised terms. |
| 19 | **Services.io** | SOE: 🟠 MID-BUILD — universal photo-gated escrow marketplace; schema/Stripe Connect/photo capture in build before a single-metro soft launch | Partner / Operator (service providers) | Local service providers | Marketplace supply | Directory/Apify local business | PREP ONLY | OFF | **Marketplace provider recruiting is not creator marketing** — keep the lists and templates separate. |
| 20 | **Solar OS** | Hub + partner routing docs exist | Partner / Operator (installers) | Installers, closers | Fulfilment | Partner network | PREP ONLY | OFF | Partner routing documented; no creator lane defined. |
| 21 | **Real Estate OS / Real Estate HQ** (SOE: *Real Estate Acquisition*) | SOE: ⚪ EARLY / CONCEPT — ingestion spec delivered, **all 51 jurisdictions default to BLOCKED pending verification** | None yet | — | — | — | PREP ONLY | OFF | No recruiting program documented. Jurisdiction block is a hard gate on any lead work. |
| 22 | **Grant OS / UBEN Grant System** | **NOT IN SOE** as its own venture (SOE folds grants into UBEN's grant-strategy stage). Hubs exist, QA docs present | None yet | — | — | — | NOT APPLICABLE (for now) | OFF | Casework, not recruiting. |
| 23 | **SBO AI Engine** (SOE: *Sports Betting AI OS / ChingWorld*) | SOE: ⚪ EARLY / CONCEPT — three-brain model backtested on 600+ picks, Twilio SMS delivery built, not revisited recently | None | — | — | — | NOT APPLICABLE | OFF | Internal product. |
| 24 | **Dynasty Connect (AI calling / comms)** | Shared infrastructure | None | — | — | — | NOT APPLICABLE | n/a | Infrastructure that recruiting *uses*; it is not a recruiting vertical. Any dialing of recruits still passes DNC/opt-out + calling-window gates. |
| 25 | **Dynasty OS / Empire HUD / Stripe Setup / Product Sourcing & Automation** | Infrastructure / internal automation | None | — | — | — | NOT APPLICABLE | n/a | Product sourcing automation is an internal function, not a creator vertical. |
| 26 | **Dynasty Media Network (videographers)** | Tables only (`media_creators` 0, applications 0), no intake, no UI. SOE names the adjacent concept **ChingWorld Music / Clipper Nation / CrowdSignal** (music label/distro) as ⚪ paper-only | Creator (videographer) | Videographers | Content production | — | PREP ONLY | OFF | Model exists, nothing else. |
| 27 | **Dynasty Partners** (business licensing program) | SOE: 🔵 BUILT, AWAITING LAUNCH — three tiers locked (Foundation/Equity/Sovereign), 16-table schema deployed; blocked on PostgREST schema exposure | **Ambassador / licensee referral (UNVERIFIED)** | Prospective licensees, referrers | Licensing sales | Manual / B2B | PREP ONLY | OFF | **Added by SOE reconciliation** — was missing from the pre-reconciliation list. Tiers are a *licensing* structure, not a recruiting commission structure. Owner decision needed on whether a referral lane exists. |
| 28 | **Dynasty Trader** | SOE: ⚪ EARLY / CONCEPT — 5-strategy pack designed, forex + Polymarket copying wanted under a 90-day paper-trading gate; audit not run | None | — | — | — | NOT APPLICABLE | OFF | **Added by SOE.** No recruiting lane. Do not source "trading creators" — regulated-claims risk with no product live. |
| 29 | **Music Label / Distro — ChingWorld Music · CrowdSignal** | SOE: ⚪ EARLY / CONCEPT — two-sided model (rails vs ownership) on paper, **no build** | Creator (artists) — future | Artists, distro clients | — | — | BLOCKED (no build) | OFF | **Added by SOE.** Distinct from Dynasty Clipper Nation (row 15), which is a real operator console. Do not merge the two lists. |
| 30 | **GasMask Munchies Box** | SOE: ⚪ EARLY / CONCEPT — corner-store food collab, menu ideas locked, deal structure open | None yet | — | — | — | NOT APPLICABLE | OFF | **Added by SOE.** Would sit under the GasMask family if it becomes a content lane. |
| 31 | **Packaging Machinery Sourcing** | SOE: ⚪ EARLY / CONCEPT — sourcing a China-made tube-fill/shrink/case line; no supplier locked | None (procurement) | — | — | — | NOT APPLICABLE | n/a | **Added by SOE.** Procurement, not recruiting. |
| 32 | **Partner Kit Fulfillment** | SOE: ⚪ EARLY / CONCEPT — cross-business onboarding-kit tiering and fees decided, no pipeline built | None (fulfilment for other lanes) | — | — | — | NOT APPLICABLE | n/a | **Added by SOE.** Relevant *later*: this is how an approved ambassador/creator would receive a kit. No pipeline today. |
| 33 | **Lead Automation Engine** | SOE: 🟠 MID-BUILD — cross-company lead ingestion brief at 50-state scope, consolidated dev doc + compliance spine delivered | None (infrastructure) | — | — | — | NOT APPLICABLE | n/a | **Added by SOE.** This is the programme Gerson's work feeds; treat §7–§10 of this document as its recruiting-side spec. |
| 34 | **GasMask invoice/AR integrity · GasMask Field Verification** | SOE: 🟠 MID-BUILD — AR reconstruction ($26K+ phantom AR corrected); Verification Crew role built but **not yet verified working live** | Field Ambassador (row 4) | — | — | — | see row 4 | OFF | **Added by SOE.** SOE corrects row 4: the verification crew is built but unconfirmed in the live system — do not treat it as proven. |

**Counted:** 34 rows. Rows 1–26 are the pre-reconciliation list (statuses corrected against SOE); rows 27–34 were added by the SOE reconciliation.

### 4.1 SOE reconciliation ledger

| SOE venture | Result |
|---|---|
| Grabba Route (GasMask/Grabba R Us/Hot Mama/Hotscolatti) | rows 1, 2 — matched, one company / four brands confirmed |
| GasMask Clothing | row 3 — status corrected to LIVE / EARNING |
| Dynasty Credit Shield | row 10 — status corrected to LIVE / EARNING (lane still undefined) |
| Dynasty Direct | row 8 — matched, checkout defect confirmed (`store_order_items` empty) |
| Dynasty Connect AI Calling | row 24 — matched, infrastructure |
| Unforgettable Times | row 6 — status corrected to BUILT/NOT WORKING |
| TopTier Experience | row 7 — status corrected, hard-fail confirmed |
| Brandaro Digital | row 14 — status corrected to BUILT/AWAITING LAUNCH |
| Dynasty Partners | **row 27 — ADDED** |
| Dynasty Funding Hub | row 9 — matched ("ready to route ambassadors in" confirmed by SOE) |
| Dynasty Recovery Group | row 11 — matched, PI-licensing blocker confirmed |
| Highway | row 12 — status corrected to MID-BUILD |
| I Clean We Clean | row 13 — matched |
| Goddess In You | row 18 — status corrected to MID-BUILD; terms confirmed *not* discussed with Sara |
| Services.io | row 19 — status corrected to MID-BUILD |
| GasMask invoice/AR · Field Verification | **row 34 — ADDED** (qualifies row 4) |
| Lead Automation Engine | **row 33 — ADDED** |
| Product Sourcing / Automation Engine | row 25 — matched, internal |
| Dynasty Trader | **row 28 — ADDED** |
| Sports Betting AI OS (ChingWorld) | row 23 — matched to SBO AI Engine |
| Music Label / Distro | **row 29 — ADDED** (Clipper Nation kept separate as row 15) |
| GasMask Munchies Box | **row 30 — ADDED** |
| Packaging Machinery Sourcing | **row 31 — ADDED** |
| Real Estate Acquisition | row 21 — status corrected; 51 jurisdictions BLOCKED |
| Playboxxx / NightWorld | row 5 — status corrected to EARLY/CONCEPT at venture level; ingest pipeline still the one working lane |
| UBEN | row 16 — status corrected to EARLY/CONCEPT |
| Partner Kit Fulfillment | **row 32 — ADDED** |
| Dynasty OS core · Empire HUD · Stripe Setup | row 25 — matched, infrastructure |
| **In §4 but NOT in SOE** | row 17 Dynasty Earn · row 22 Grant OS — retained and flagged; see §16 |

Solar OS (row 20) and Dynasty Media Network (row 26) are also absent from SOE as named ventures; both are retained because they exist as hubs in the running OS. Flagged in §16.

---

## 5. Priority Recruiting Queue (for Gerson)

### PRIORITY 1 — CAN SOURCE NOW (clear target profile, working or trivially reusable intake)

1. **Playboxxx / NightWorld — creators + staff.** Pipeline proven end-to-end. Keep going; this is the reference implementation.
2. **Dynasty Clipper Nation — clippers.** Target profile is unambiguous (short-form edit accounts, view volume). Pool only; payouts not production-ready.
3. **ICW — cleaners / service workers.** Real intake form exists (`/apply/cleaner`) and real dedupe/provenance code exists. Source workers, not customers.
4. **Unforgettable Times — event/party creators + venue partners.** Shared `business_leads` substrate already carries 297k UT rows and per-business views.

### PRIORITY 2 — BUILD CANDIDATE POOL, DO NOT OUTREACH (sourcing safe, activation/revenue not ready)

5. **Dynasty Funding Hub — referral ambassadors** (pending Ching's confirmation of the referral lane and terms).
6. **GasMask Clothing — streetwear/UGC creators.**
7. **Dynasty Direct — product creators/affiliates** (checkout defect).
8. **TopTier — supply partners** (dispatch blockers).
9. **GasMask / Grabba — local brand creators** (compliance review first).
10. **Services.io / Solar — local providers and installers.**

### PRIORITY 3 — HOLD

11. Dynasty Credit Shield (no defined lane) · Dynasty Recovery Group / Surplus (licensing-gated) · Highway (legal + operator ingestion incomplete) · Goddess In You (terms unconfirmed) · Real Estate · Grant OS · Dynasty Earn (undefined) · Brandaro creator lanes (undocumented) · Dynasty Media Network (no intake).

---

## 6. Business-by-Business Recruiting Scope

Detail beyond §4 only where it changes what Gerson does.

**Playboxxx / NightWorld.** Two distinct sub-lanes sharing one ingest: (a) **social creators** — Instagram/TikTok, roles `model | creator | photographer | cameraman | videographer`; (b) **staff/vendors** — Overpass/OSM place data, roles mapping to `beauty | private_chef | cleaner | decorator | florist | staff`. Stage 1 is **US-only** (`state` must be a 2-letter US state). Adult-content candidates must carry the adult flag and must never be exported into a general-market list. OSM-derived rows are ODbL — internal use only, never published or sold.

**GasMask family.** One operating company, four brands. Field roles (bikers, verification crew, store acquisition) are a **workforce**, sourced locally and manually — Apify is not the tool. Any *online* creator lane for these brands is new and needs a compliance read before a single search is run.

**Unforgettable Times.** Keep the existing ambassador structure. The five `ut_campaigns` marked `active` have zero leads behind them — that is a false "on" signal, not a running program. Commission display is defective; do not quote earnings to a recruit.

**ICW.** Source **providers/workers**, not customers. Non-US rows already leaked into `icw_sourced_leads` (England, Ireland, AU, CA) — filter to US at the Apify/Make layer. 27 of 47 rows have no coordinates; capture lat/long at ingest where the actor provides it.

**Clipper Nation.** Target: accounts that already clip/repost other people's footage, with visible view counts. Capture platform, handle, avg views. Do not promise payout terms — Wise/PayPal are sandbox and there is no weekly auto-payout.

**Dynasty Funding / Credit Shield / Recovery.** Financial-services adjacency. Nothing here is approved for outreach, and no commission rate exists in the system to quote. Recovery/Surplus is licence-gated per state.

---

## 7. Shared Apify Search Framework

Reusable shape, not Playboxxx-specific:

```
Apify actor (per platform)
  → normalized candidate objects
  → Make scenario (filter + qualify + tag business/role)
  → Dynasty ingest webhook (shared-secret header)
  → business-scoped lead store
  → human review
  → (only if approved) outreach
```

Per search run, always record: `source_actor` (actor name/id), `source_search` (the literal query, e.g. `"Miami Model"`), `scraped_at`, `intended_business`, `intended_role`. Provenance is not optional — a candidate whose search is unknown cannot be audited or re-targeted.

Search axes to parameterise (never hardcode to one business): platform · geography (city/state/country) · niche/hashtag · follower band · language · role keyword.

Rate/volume discipline: cap batches at 500 leads per POST (current ingest limit), branch in Make on `counts.inserted / duplicate / invalid`, and stop on repeated 4xx rather than retrying a broken run.

---

## 8. Shared Make / Ingestion Framework

- **Auth:** shared secret in a request header, compared server-side. No Supabase JWT, anon key or service-role key ever goes to Make.
- **Idempotency:** every batch carries a `run_id`; every lead carries `external_profile_id`/`external_id`.
- **Business scoping:** `intended_business` is **mandatory and has no default**. A candidate with no business is a candidate nobody will find. (Same rule the shared lead table already enforces.)
- **Response contract:** HTTP 200 with `{ counts: { received, inserted, duplicate, invalid }, results: [...] }` even when some rows are invalid, so Make routes on counts.
- **Unknown fields:** allow-list the known fields, keep the rest in an `extra` object, log unknown field *names*, and echo them back — never silently discard.
- **Insert-only:** the payload may not set business, status, ids or timestamps.
- **Today's reality:** exactly one such endpoint exists (`playboxxx-recruiting-ingest`). Generalising it to other businesses is a build task and is **not** part of this document.

---

## 9. Candidate Data Contract (conceptual — no DB changes in this task)

| Field | Notes |
|---|---|
| `external_profile_id` | platform-native id; strongest dedupe key |
| `platform` | instagram · tiktok · youtube · osm/overpass · web · directory |
| `profile_url` | canonical, lower-cased host, no query string |
| `username` / `handle` | leading `@` stripped |
| `display_name` | — |
| `bio` | cap 1000 chars |
| `follower_count`, `following_count`, `post_count` | integers, null when unknown (never 0-as-unknown) |
| `avg_views`, `avg_likes`, `avg_comments`, `engagement_rate` | null unless the actor actually returned them |
| `email`, `phone` | phone normalised to E.164 for NANP; last-10 for matching |
| `location`, `country`, `state`, `city` | state validated for US rows |
| `niche`, `content_categories[]` | free vocabulary at ingest, mapped to a business's own taxonomy at review |
| `adult_content_flag` | required for Playboxxx/NightWorld; must remain set through every downstream copy |
| `source`, `source_actor`, `source_search`, `scraped_at` | provenance block — all four or the row is unauditable |
| `intended_business`, `intended_role` | mandatory, no default |
| `qualification_score`, `qualification_reasons[]` | reasons are text, human-readable |
| `review_status` | `new → reviewed → approved → rejected` |
| `duplicate_key` | see §10 |
| `notes` | free text |

Nullable everywhere except: `intended_business`, `intended_role`, `platform`, and at least one of (`external_profile_id`, `profile_url`, `phone`, `email`).

---

## 10. Identity Dedupe vs Business Association

Two separate concepts. Collapsing them loses real relationships.

**IDENTITY DEDUPE** — is this the same human/account?
Match order, first hit wins:
1. `platform` + normalised `username`
2. canonical `profile_url`
3. `external_profile_id`
4. normalised email
5. phone last-10
6. (weak, review-only) normalised name + city + state

**BUSINESS/PROGRAM ASSOCIATION** — which programs is this identity in?
One identity may legitimately be associated with several businesses (a Miami event creator can serve UT *and* Playboxxx — subject to §14 segmentation).

Rules:
- **Never delete a candidate because they exist under another business.** Add an association, do not overwrite.
- Duplicate *within the same business + role* → not re-inserted, existing id returned, no overwrite.
- Duplicate *across businesses* → new association row, shared identity.
- Suppression (DNC / opt-out) is identity-level and business-blind: one STOP suppresses that person for **every** business.

---

## 11. Qualification Rules

No global rule. Factors to consider per lane; **thresholds are not invented here.**

| Lane | Factors that matter | Thresholds |
|---|---|---|
| Playboxxx creators | geography, follower band, content niche, adult suitability, contactability | **TBD — OWNER/TEAM DECISION** |
| Playboxxx staff/vendors | US state, category match, phone present, line type (desk line ≠ mobile) | Existing: US-state required, role must map |
| Clippers | avg views, posting frequency, editing evidence, platform mix | **TBD — OWNER/TEAM DECISION** |
| UT event creators | geography (metro), event/party niche, audience fit | **TBD** |
| GasMask Clothing / brand creators | geography, streetwear niche, brand safety, engagement | **TBD** + compliance read |
| ICW workers | local availability, category, licence status where gated, contactability | Licence gating exists in schema but the gate columns are NULL — **unenforced today** |
| Funding / Credit / Recovery referrals | brand safety, regulated-claims risk, state licensing | **TBD — legal input required** |
| Field ambassadors | local availability, transport, ID/verification | **TBD** |

Contactability note: a candidate with no email, no phone and no DM path is not a lead. The existing 139 YouTube-sourced rows have 0 emails and 1 phone — that is the failure mode to avoid.

---

## 12. Review Workflow

```
sourced (Apify)  →  ingested (Make → webhook)  →  review queue
      →  approved  →  program association  →  [outreach gate]  →  contacted
      →  rejected (reason recorded, identity kept for future dedupe)
```

- Every candidate lands in **review**, never in an active outreach list.
- Review is per business + role, because the same person may be approved for one and rejected for another.
- Rejections are kept, not deleted — they prevent re-sourcing the same person next run.
- No auto-approval, no auto-promotion to a roster.

---

## 13. Outreach Activation Rules

Every business/program carries one explicit value: **OFF · READY FOR MANUAL REVIEW · APPROVED · BLOCKED.**

**Current value for every business in §4: OFF.**

Enforced in the system today: `outreach_switches` (16 rows, 0 enabled) and `outreach_allowed()`, which fails closed. Suppression (`dnc_list`, `opt_out_events`) applies to any future SMS/voice regardless of business, matched on last-10 digits.

Gerson's current mandate is **SEARCH → INGEST → QUALIFY** only. Flipping any switch is an owner decision, not an engineering one.

---

## 14. Compliance / Segmentation Notes

- **Adult segmentation.** Playboxxx/NightWorld candidate lists must never be merged into general-market brand campaigns, exported into shared outreach lists, or messaged from a general-market sender. Carrier/10DLC and platform policy restrict adult content in SMS and paid social.
- **OSM / Overpass data is ODbL** — internal enrichment and outreach only; never published, sold, or exposed on a public surface. Tag `source='osm'`.
- **Tobacco-adjacent brands** (GasMask/Grabba family) face platform advertising and creator-policy limits — get a compliance read before running branded creator campaigns.
- **Regulated verticals** (Funding, Credit Shield, Recovery/Surplus, ICW licensed categories) — state licensing and claims rules govern who may be recruited and what may be said. Licensing research in `icw_state_config` is explicitly flagged *"review by licensing attorney before operational use."*
- **Field roles stay separate** from the online Creator Army: different sourcing, different vetting (ID, transport), different data.
- **Suppression is universal.** One opt-out silences that person across every Dynasty business.

---

## 15. Gerson Execution Checklist

- [ ] Use the State of the Empire document as the business list — **request it from Ching first** (§2.1); this document's §4 is provisional until reconciled.
- [ ] Preserve the working Playboxxx pipeline exactly as-is; extend, never replace.
- [ ] Generalise the reusable parts of Apify → Make (search params, normaliser, batch/response contract) instead of cloning Playboxxx per business.
- [ ] Set `intended_business` and `intended_role` on every candidate — no defaults, no blanks.
- [ ] Record full provenance: `source_actor`, `source_search`, `scraped_at`, `run_id`.
- [ ] Dedupe identities per §10; never delete a candidate for existing under another business.
- [ ] Route everything to review; approve nothing automatically.
- [ ] Send no outreach — every switch stays OFF until Ching approves in writing.
- [ ] Work Priority 1 first (Playboxxx, Clippers, ICW workers, UT), Priority 2 as pool-only.
- [ ] Report back per business: candidates sourced, inserted/duplicate/invalid counts, and the blocker preventing activation.

---

## 16. Open Decisions / Blockers — for Ching

1. **State of the Empire document not received.** Required to finalise the business list. Everything in §4 is provisional.
2. **Dynasty Funding Hub referral lane** — is it approved, and on what terms? No commission rate exists anywhere in the system; none was invented.
3. **Dynasty Credit Shield** — does a referral/affiliate lane exist at all? Default answer used here: no.
4. **Dynasty Earn** — program definition unverified.
5. **Goddess In You** — are business terms with Sara finalised? Assumed no.
6. **Brandaro** — are affiliates / appointment setters / B2B creators an actual program, or an idea?
7. **Qualification thresholds** — every "TBD" in §11 needs an owner/team number.
8. **Commission structures** — none are documented outside UBEN's tier language and the clipper per-1k/commission fields. Nothing else may be quoted to a recruit.
9. **Known defects that must not be sold as live:** UT ambassador commission totals; Dynasty Direct checkout/money path; TopTier dispatch; Clipper Wise/PayPal sandbox payouts; ICW inert licensing gate + stub job intake.
10. **Ambassador logins** — 76 ambassador records are login-required after the shared-login unlink; recruiting more ambassadors before this is closed adds people who cannot see their routes.
11. **Canonical candidate store** — creator candidates currently have no dedicated home (139 YouTube rows sit in the generic business lead table with no contact info). Where creator candidates live is a build decision that must be made before large-scale sourcing.
