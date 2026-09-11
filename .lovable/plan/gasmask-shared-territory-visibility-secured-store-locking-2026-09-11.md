# GasMask Shared Territory Visibility + Secured Store Locking

## Goal

Make geographic territory control which live stores ambassadors can see, while keeping routes and direct assignments separate from actual store ownership. A store stays available until an ambassador explicitly secures it.

## Implementation

1. **Normalize area visibility**
   - Reuse `ambassador_territory_coverage` as the source of geographic access.
   - Add a secured, authenticated database function/view that returns all live canonical stores matching the signed-in ambassador’s state, city, borough, or neighborhood coverage.
   - Include direct assignments and recent route stops as additional access paths, without treating either as a claim.
   - Update the ambassador portfolio, map, store list, profile access, and route store pool to read this effective visible-store set.

2. **Add explicit store claims**
   - Add the smallest dedicated claim record because no existing field reliably means “secured by this ambassador.”
   - Store the canonical store, ambassador, secured timestamp, release state, and audit actor.
   - Enforce one active claim per store with a database unique rule and an atomic claim function.
   - The claim function will verify the signed-in ambassador identity and area/direct/route access, return the existing owner when already claimed, and never infer a claim from check-ins or route completion.

3. **Apply only approved territories and profiles**
   - Preserve Ching—Brooklyn, Javier—Staten Island/New Jersey, Rufino—Bronx, Shawn—Connecticut, Looney—Delaware, and Chico—Florida.
   - Record Oliver as Queens only.
   - Create or safely match Bosket (`Huntatrell@gmail.com`) and Billz (`GmbhBillz@gmail.com`) as separate ambassador profiles, both with Georgia visibility.
   - Do not send invitations and do not modify Inter, SL, Mooks, Relleo, or Chico’s additional areas.

4. **Make claim status visible before field work**
   - Show `Available / Unsecured` or `Secured`, the ambassador’s display name, and secured date/time on store cards, map details, and store profiles.
   - Add a confirmed **Secure store** action only for unclaimed visible stores.
   - Keep another ambassador’s private contact and account details hidden.
   - Keep call, message, directions, check-in, route membership, and route optimization independent from claim ownership.

5. **Verification and cleanup**
   - Use two temporary Georgia stores to prove Bosket and Billz share visibility, neither owns by territory alone, one can atomically secure Store A, the other still sees its owner but cannot claim it, and Store B remains available.
   - Remove all temporary stores, assignments/routes, and claims after verification.
   - Recheck Ching’s Brooklyn map and optimized route path, and verify Oliver receives Queens visibility without Brooklyn.
   - Confirm old direct assignments produced zero secured claims.
   - Update `docs/audits/GASMASK-SHARED-TERRITORY-STORE-LOCKING-2026-09-12.md` with the requested models, test results, person table, and held decisions.

## Technical details

- Schema changes use a migration with explicit grants, RLS, claim-history preservation, and a partial unique index for one active claim per store.
- Geographic matching will normalize state abbreviations/full names and use canonical `store_master` city/borough/neighborhood fields; it will not invent coordinates or alter store records.
- Existing `routes` and `route_stops` remain canonical and unchanged in meaning.
- Existing `ambassador_assignments`, including Ching’s historical Brooklyn access rows, remain operational access only.
- All mutations will surface database errors and refresh the affected store/map/route queries.

## Out of scope

- Invitation delivery, email-provider repair, outreach, automatic claiming from visits, territory splitting, claim release/reassignment UI, or any decision for Inter, SL, Mooks, Relleo, and Chico beyond Florida.