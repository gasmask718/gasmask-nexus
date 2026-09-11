# GasMask P0-3 live map repair

## Verified starting point
- Current exact count: 291 live, non-deleted stores lack usable coordinates.
- 175 meet the structural address rule, but one is the known placeholder `Unknown, Unknown, NY 00000`; therefore 174 are safe automatic candidates.
- Keep the 113 stores without a street address and 3 incomplete street-only records untouched.
- Provider: the existing `batch-geocode-stores` function uses Mapbox forward geocoding. Its current temporary endpoint has a free allowance but does not permit permanent coordinate storage; the correct permanent path is approximately $0.88 for 174 requests ($5/1,000), below the user’s “significant exposure” stop condition.
- Existing safeguards are a 1,000-row cap, batches of 50, a one-second inter-batch pause, null-coordinate filtering, and basic placeholder filtering. The current function does not exclude deleted/test rows, can rewrite normalized addresses, accepts low-confidence first results, and has no explicit function configuration entry.

## Safe execution
- Reuse `batch-geocode-stores`; do not create another geocoder or map.
- Narrow the existing job to live, non-test stores with missing/invalid coordinates and sufficient street, locality, and state data.
- Add confidence/precision checks so ambiguous results remain unresolved for manual review.
- Update coordinates only, through the existing `stores` path; never replace valid coordinates or alter identity, address, contact, business, or assignment data.
- Keep the current batch cap and paced requests; return exact processed, repaired, ambiguous, failed, and skipped counts.

## Validation and evidence
- Snapshot valid-coordinate, store-count, identity/contact/business, and assignment totals before and after.
- Confirm zero valid coordinates overwritten, zero duplicate stores, and zero assignment changes.
- Verify repaired samples in the existing GasMask map and document the exact before/after results.
- Update `docs/audits/GASMASK-MAP-LOCATION-REPAIR-2026-09-11.md` with the remaining manual-cleanup groups.

## Execution gate
- Run only after confirming the existing Mapbox account path has no unknown/significant paid exposure for this batch. Otherwise stop after the cost report without sending requests.
