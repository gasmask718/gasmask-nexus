# GasMask — Ching's Current Ambassador Roster: Reconciliation & Assignment Plan
Date: 2026-09-11 · Mode: READ-ONLY (no records created, no invites sent, no stores assigned, no routes created)
Scope: ONLY the 9 people on Ching's owner-provided roster. The other 78 active ambassador records are explicitly OUT of immediate onboarding scope.

---

## STEP 1 — MATCH AGAINST EXISTING RECORDS

Method: searched `public.ambassadors` by exact email (all 7 supplied addresses), then by name (regex + ILIKE on javier/smith/shawn/warner/nutt/rufino/vinales/billz/looney/mook/chico/oliver/valenzuela/SL). Also checked `auth.users` for all 7 emails.

| # | Person | Email | DB match | Ambassador ID | Login (user_id) | Current territory fields | Assigned stores | Routes | Class |
|---|--------|-------|----------|---------------|-----------------|--------------------------|-----------------|--------|-------|
| 1 | Javier Smith | Smithjavier770@gmail.com | none | — | none | — | 0 | 0 | NOT FOUND |
| 2 | Shawn Warner / Nutt | WARNERSHAWN628@gmail.com | none | — | none | — | 0 | 0 | NOT FOUND |
| 3 | SL | BELIEVEITORNOTT28@gmail.com | name match `SL` (email field empty, phone 929-944-3067) | 0ddde0f3-9a7c-4276-98f6-700ecd76fc6f | none | city/state/neighborhood all NULL | 0 | 0 | POSSIBLE MATCH — REVIEW |
| 4 | Rufino Vinales | RUFINOVINALES@gmail.com | none | — | none | — | 0 | 0 | NOT FOUND |
| 5 | Billz | not provided | none | — | none | — | 0 | 0 | NOT FOUND + EMAIL REQUIRED |
| 6 | Looney | BOOKLOONEYMAC@gmail.com | none | — | none | — | 0 | 0 | NOT FOUND |
| 7 | Mooks | not provided | none | — | none | — | 0 | 0 | NOT FOUND + EMAIL REQUIRED |
| 8 | Chico | DJSKRATCH2007@yahoo.com | none | — | none | — | 0 | 0 | NOT FOUND |
| 9 | Oliver | Oliverferminvalenzuela@gmail.com | none | — | none | — | 0 | 0 | NOT FOUND |

Facts:
- **Zero of the 7 supplied emails exist** on any ambassador record or any auth account.
- Only candidate match is the single-token name `SL`, which has a phone but no email and no territory data. Identity is ambiguous (initials only) → owner confirmation required before linking `BELIEVEITORNOTT28@gmail.com` to that record.
- No duplicates were created; nothing was written.

## STEP 2 — LOGIN READINESS

Existing invite flow to reuse (already built, used once):
`create_ambassador_invite` → `send-ambassador-invite` → `/ambassador/invite/accept` (`AmbassadorInviteAccept`) → `accept_ambassador_invite`.

| Person | Unique login exists | Can provision via existing invite flow | Status |
|---|---|---|---|
| Javier Smith | no | yes (email on file) | LOGIN REQUIRED — invite-ready |
| Shawn Warner | no | yes | LOGIN REQUIRED — invite-ready |
| SL | no | only after identity confirmed | LOGIN REQUIRED — blocked on identity |
| Rufino Vinales | no | yes | LOGIN REQUIRED — invite-ready |
| Billz | no | no contact info | LOGIN BLOCKED — EMAIL REQUIRED |
| Looney | no | yes | LOGIN REQUIRED — invite-ready |
| Mooks | no | no contact info | LOGIN BLOCKED — EMAIL REQUIRED |
| Chico | no | yes | LOGIN REQUIRED — invite-ready |
| Oliver | no | yes | LOGIN REQUIRED — invite-ready |

No shared or fabricated logins. Billz and Mooks stay LOGIN BLOCKED.

## STEP 3 — TERRITORY vs LIVE STORE DATA

Live universe = `store_master` where `deleted_at IS NULL` and not simulation; coordinates read from `stores.lat/lng` (same id).

| Territory | Live stores | With coordinates | Missing coordinates | Already assigned to someone |
|---|---|---|---|---|
| Staten Island (Javier) | 32 | 27 | 5 | 0 |
| New Jersey (Javier) | 7 | 5 | 2 | 0 |
| Connecticut (Shawn) | 0 | 0 | 0 | 0 |
| Bed-Stuy subset (SL) | 38 | 35 | 3 | 0 |
| Manhattan (SL / Oliver) | 195 | 175 | 20 | 0 |
| Bronx (Rufino) | 98 | 91 | 7 | 0 |
| Mt. Vernon (Rufino) | 1 | 1 | 0 | 0 |
| Georgia (Billz) | 0 | 0 | 0 | 0 |
| Delaware (Looney) | 0 | 0 | 0 | 0 |
| Pennsylvania (Mooks) | 0 | 0 | 0 | 0 |
| Florida (Chico) | 0 | 0 | 0 | 0 |
| Brooklyn (Oliver, incl. Bed-Stuy) | 975 | 877 | 98 | 4 |
| Queens (Oliver) | 238 | 199 | 39 | 0 |
| Other / unmapped state | 153 | 34 | 119 | 0 |

Currently assigned stores in the whole book: only 4 total — 2 to "ching", 2 to "BARRY KALI ENY" (both Brooklyn). Nothing this roster would touch is owned by another ambassador except those 4.

Overlaps requiring owner review:
- **Oliver (all NYC) vs SL (Bed-Stuy + Manhattan)** — 195 Manhattan + 38 Bed-Stuy stores claimed by both.
- **Oliver vs Rufino** — Bronx (98) is inside "entire NYC" if read literally.
- **Oliver vs Javier** — Staten Island (32) likewise.
- Recommendation: treat Oliver as remainder-of-NYC (Brooklyn ex-Bed-Stuy + Queens = ~1,175 stores) and let the narrower owners keep their areas. Needs Ching's yes/no.
- Chico's "London / other connections" has no store data and no territory model → out of scope for store assignment.

## STEP 4 — SAFE ASSIGNMENT PLAN

| Ambassador | DB match | Login status | Territory | Eligible stores (usable coords) | Conflicting | Missing coords | Ready to assign? | Exact next action |
|---|---|---|---|---|---|---|---|---|
| Javier Smith | NOT FOUND | invite-ready | Staten Island + NJ | 32 | 0 | 7 | After record + invite | Create ambassador record, send invite, then assign SI+NJ |
| Shawn Warner | NOT FOUND | invite-ready | Connecticut | 0 | 0 | 0 | No stores to assign | Create record + invite; CT store book is empty — needs prospecting decision |
| SL | POSSIBLE MATCH | blocked on identity | Bed-Stuy + Manhattan | 210 | 233 shared w/ Oliver | 23 | No | Ching confirms `SL` record = BELIEVEITORNOTT28@gmail.com, then attach email + invite |
| Rufino Vinales | NOT FOUND | invite-ready | Bronx + Mt. Vernon | 92 | 98 if Oliver takes all NYC | 7 | After record + invite | Create record, invite, assign Bronx + Mt. Vernon |
| Billz | NOT FOUND | LOGIN BLOCKED | Georgia | 0 | 0 | 0 | No | Ching provides email/phone |
| Looney | NOT FOUND | invite-ready | Delaware | 0 | 0 | 0 | No stores to assign | Create record + invite; DE store book empty |
| Mooks | NOT FOUND | LOGIN BLOCKED | Pennsylvania | 0 | 0 | 0 | No | Ching provides email/phone |
| Chico | NOT FOUND | invite-ready | Florida / London | 0 | 0 | 0 | No stores to assign | Create record + invite; FL store book empty |
| Oliver | NOT FOUND | invite-ready | All NYC | 1,076 (Bklyn+Queens ex-Bed-Stuy) | 233–363 depending on ruling | 137 | After scope ruling | Ching rules on NYC boundary, then create record + invite |

## STEP 5 — P0 CAPTURE DEFECT INTERACTION

Open P0: field-captured stores lose phone/contact/notes on sync to `store_master` and get no driver/business/route linkage. Therefore:
- Assign this roster only from canonical `store_master` rows with complete address + coordinates.
- The 119 "other/unmapped state" rows and the 137 NYC rows missing coordinates should be excluded from the first assignment wave, not force-assigned.

---

## STEP 6 — SUMMARY

ROSTER SIZE: 9

EXACT EXISTING MATCHES: 0
POSSIBLE MATCHES: 1 (SL — 0ddde0f3-9a7c-4276-98f6-700ecd76fc6f, initials-only, no email on record)
NOT FOUND: 8
LOGIN READY (already has a login): 0
LOGIN REQUIRED (invite-provisionable now): 6 — Javier, Shawn, Rufino, Looney, Chico, Oliver
EMAIL REQUIRED (login blocked): 2 — Billz, Mooks
IDENTITY CONFIRMATION REQUIRED: 1 — SL

STORE COUNTS BY TERRITORY: Staten Island 32 · NJ 7 · Bronx 98 · Mt. Vernon 1 · Manhattan 195 · Bed-Stuy 38 · Brooklyn 975 · Queens 238 · CT/GA/DE/PA/FL 0 each · unmapped 153

OVERLAPS REQUIRING OWNER REVIEW: Oliver ↔ SL (Manhattan + Bed-Stuy), Oliver ↔ Rufino (Bronx), Oliver ↔ Javier (Staten Island)

AMBASSADORS READY FOR ASSIGNMENT NOW (record + invite + real stores exist): Javier (SI/NJ), Rufino (Bronx/Mt. Vernon) — pending Oliver boundary ruling

AMBASSADORS BLOCKED:
- Billz, Mooks — no contact information
- SL — identity confirmation
- Oliver — NYC boundary decision
- Shawn, Looney, Chico — no stores exist in their states (record + login can proceed; territory is greenfield prospecting)

DECISIONS NEEDED FROM CHING:
1. Is the existing `SL` record (phone 929-944-3067) the same SL?
2. Does Oliver own all NYC, or NYC minus Javier/SL/Rufino's areas?
3. Contact info for Billz and Mooks.
4. CT/GA/DE/PA/FL have zero stores — are these prospecting territories rather than assignment territories?

No invites sent. No stores assigned. No routes created. No records written.
