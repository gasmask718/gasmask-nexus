# GasMask P0-3 — Live Store Map Location Repair

**Date:** 2026-09-11  
**Scope:** Existing `stores` records and existing GasMask map/geocoding path only

## Result

| Measure | Exact result |
|---|---:|
| Live stores missing map location before | 291 |
| Structurally eligible before placeholder exclusion | 175 |
| Eligible for automatic geocoding | 174 |
| Successfully geocoded | 152 |
| Ambiguous / failed | 22 ambiguous, 0 provider failures |
| No street address | 113 |
| Street present but insufficient city/state/ZIP | 3 |
| Invalid placeholder excluded before execution | 1 |
| Live stores still missing map location after | 139 |
| Valid existing coordinates overwritten | 0 |
| Duplicate stores created | 0 |
| Store assignments changed | 0 |

## Pre-write verification

- Exact live store count: 1,700.
- Exact live stores missing valid coordinates: 291.
- 175 rows met the structural address test. One was the known placeholder `Unknown, Unknown, NY 00000`, so the safe executable set was 174.
- 113 rows had no street address.
- Three additional rows had a street value but insufficient locality data.
- Existing tool reused: `batch-geocode-stores`.
- Existing provider reused: Mapbox forward geocoding.
- Permanent geocoding was used because the returned coordinates are stored.
- Estimated exposure was approximately $0.87–$0.88 for 174 requests at about $5 per 1,000 requests. No new provider or paid dependency was introduced.
- Existing safeguards retained: maximum 1,000 candidates, batches of 50, and one-second pauses between batches.

## Safety hardening

The existing geocoder was narrowed before execution:

- requires an authenticated owner/admin account;
- considers only live, non-simulation, non-test stores with missing coordinates;
- rejects placeholder and incomplete addresses;
- uses permanent geocoding;
- accepts only address-level results with relevance of at least 0.8;
- verifies state, postcode, and city context;
- updates only `lat` and `lng`, guarded so a coordinate added concurrently is not overwritten;
- reports ambiguous matches separately instead of guessing;
- supports a no-write dry run.

The dry run returned exactly 174 eligible rows before any geocoding request was executed.

## Execution and validation

The first live pass returned all 174 as ambiguous and wrote no coordinates because Mapbox returned full state names while source rows use state abbreviations. The confidence comparison was corrected to accept Mapbox's verified state code, and the function was redeployed. No thresholds were lowered.

The corrected pass returned:

- 152 geocoded;
- 22 ambiguous;
- 0 failed;
- 0 skipped.

Post-run validation:

- valid live coordinates increased from 1,409 to 1,561;
- live missing coordinates decreased from 291 to 139;
- the live identity/contact/business hash remained `a457c7132d4ae8f2628c3f2f798b0ac9`;
- the assignment hash remained `95aea19ad0997a184cfc87ed68ef2bd4` with 17 rows;
- total `stores` rows remained 3,265;
- no duplicate primary IDs or store codes were created;
- exactly 152 approved stores received coordinate updates during the repair window.

## Existing map verification

The existing authenticated GasMask map at `/map` loaded successfully with a Mapbox canvas and its existing store markers. A repaired sample, **8421 Deli, 8421 7th Ave, Brooklyn**, was found through the existing map search, selected, and displayed at its repaired location with the existing details and navigation actions. No new map was created.

## Remaining manual-cleanup group

The 139 unresolved live stores comprise:

- 113 with no street address;
- 3 with a street value but insufficient locality data;
- 22 with a provider result that did not satisfy the confidence checks;
- 1 known placeholder address.

These records were not guessed or modified. They require address correction or manual review before another geocoding pass.