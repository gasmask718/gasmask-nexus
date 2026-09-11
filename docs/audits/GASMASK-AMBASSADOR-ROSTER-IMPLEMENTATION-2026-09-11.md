# GasMask Ambassador Roster Implementation

**Date:** 2026-09-11  
**Scope:** Ching's nine-person roster only

## Outcome

Six dedicated ambassador profiles were created using the exact owner-provided email addresses. Existing ambassador, assignment, store, route, and invitation systems were reused. No auth users, duplicate portals, shared credentials, stores, coordinates, or routes were created.

| Person | Result | Territory record | Active store assignments | Invitation |
|---|---|---|---:|---|
| Javier Smith | Profile created | Staten Island / New Jersey | 39 | Pending; email delivery rejected by provider (403) |
| Shawn Warner / Nutt | Empty-state profile created | Connecticut | 0 | Pending; email delivery rejected by provider (403) |
| SL | `IDENTITY_CONFIRMATION_REQUIRED` | Bed-Stuy / Manhattan | 0 | Not created or sent |
| Rufino Vinales | Profile created | Bronx / Mt. Vernon | 97 | Pending; email delivery rejected by provider (403) |
| Billz | `CONTACT_REQUIRED` | Georgia | 0 | Not created or sent |
| Looney | Empty-state profile created | Delaware | 0 | Pending; email delivery rejected by provider (403) |
| Mooks | `CONTACT_REQUIRED` | Pennsylvania | 0 | Not created or sent |
| Chico | Empty-state profile created | Florida / other connections | 0 | Pending; email delivery rejected by provider (403) |
| Oliver | Profile created; boundary pending | Broad NYC including Brooklyn / Queens | 0 | Pending; email delivery rejected by provider (403) |

## Assignment reconciliation

- Javier received all 39 currently live, non-simulation canonical stores in the requested scope: 32 Staten Island and 7 New Jersey.
- Rufino received all 97 currently live, non-simulation canonical stores in the requested scope: 96 Bronx and 1 Mount Vernon.
- The prior planning count was 99 for Rufino. At implementation time, the canonical live/non-simulation query returned 97. Two nonexistent or no-longer-live rows were not fabricated or assigned.
- No target store already had an active ambassador assignment.
- No duplicate active assignment exists within either new portfolio.
- Oliver received no stores because his broad NYC territory overlaps narrower territories and requires an owner boundary decision.
- Shawn, Looney, and Chico remain valid empty-state profiles because their territories contain no current canonical stores.

## Identity and invitation controls

- Immediately before creation, none of the six exact emails existed in auth or the ambassador roster.
- Each pending invite is linked to its matching pre-created ambassador profile through `target_ambassador_id`.
- SL's existing name-only possible match remains untouched; no duplicate profile or invitation was created.
- Billz and Mooks remain uncreated because no email was supplied.
- No new profile has an auth user until its recipient accepts the invitation.
- Acceptance will link the existing profile and add only the `ambassador` role. No owner/admin/employee role is preassigned.
- Ching's existing admin and ambassador identity remains unchanged.

## Delivery result and blocker

The existing email invitation function was invoked once for each of the six authorized recipients. All six requests reached the configured mail provider, but the provider rejected delivery with HTTP 403. The function correctly returned failure and recorded each failed attempt; none was reported as delivered.

The six invitations remain pending and linked correctly. They expire 48 hours after creation. The mail sender/domain must be authorized with the configured provider, then the same invitations can be resent without creating duplicates.

## Portal and workflow validation

- Portfolio reads use the existing `ambassador_assignments` relationship and the logged-in ambassador identity.
- Assignment RLS limits ambassadors to their own assignment rows; elevated users retain administrative management access.
- Existing store cards expose call, message, route, and map actions. Assigned Javier and Rufino portfolios contain records with phone data and map-ready coordinates, so those actions have usable samples.
- Real member sign-in and exact scoped browser visibility cannot be completed until an invitation is delivered and accepted, because dedicated auth accounts do not yet exist.
- No accidental elevated access was found on the six pre-created profiles.

## Remaining owner/provider actions

1. Authorize a production sender/domain with the configured email provider and resend the existing six pending invitations before expiry.
2. Confirm whether the existing name-only `SL` record is the intended person before linking or inviting.
3. Supply exact contact emails for Billz and Mooks.
4. Decide Oliver's NYC boundary before assigning any stores.
5. Review the two-store difference between the historical Rufino count (99) and current canonical live count (97); do not assign archived or nonexistent rows merely to match the earlier count.