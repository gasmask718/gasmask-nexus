# GasMask P0-3 live map repair

## Verified starting point
- Recount the live, non-deleted store population immediately before execution.
- Keep the 113 stores without a street address and 3 incomplete street-only records untouched.
- Exclude invalid placeholder addresses from automatic geocoding.

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
