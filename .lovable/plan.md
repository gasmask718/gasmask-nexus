

# Address Validation, Normalization, and Full Store Mapping

## Problem
Your store data is messy:
- **2,804 stores** have addresses but no map coordinates
- Many stores have full addresses crammed into the street field (e.g., "1403 Rockaway Pkwy, Brooklyn, NY 11236, USA") with city/state/zip left blank
- Some stores have placeholder text like "No address"
- Only **147 out of 2,959** stores currently appear on the live map

## What Will Change

### 1. Upgrade the Batch Geocode Function
The existing `batch-geocode-stores` edge function currently only saves lat/lng. It will be upgraded to also:

- **Validate** each address through Mapbox -- if Mapbox returns a result, it's a real address
- **Normalize** the address fields by parsing Mapbox's response to extract the correct street, city, state, and ZIP into their proper columns
- **Flag invalid addresses** -- stores where Mapbox returns no result will have their `address_country` set to `UNVERIFIED` so ops can review them
- Process up to 1,000 stores per run (multiple runs needed for all 2,800+)

For example, a store with:
```text
address_street: "1403 Rockaway Pkwy, Brooklyn, NY 11236, USA"
address_city: (empty)
address_state: (empty)
address_zip: (empty)
```
Will be corrected to:
```text
address_street: "1403 Rockaway Parkway"
address_city: "Brooklyn"
address_state: "New York"
address_zip: "11236"
lat: 40.6457
lng: -73.9028
```

### 2. Re-geocode Already-Geocoded Stores (Optional Flag)
The function will accept a `revalidate=true` parameter to also re-check the 147 stores that already have coordinates, ensuring their address fields are properly normalized too.

### 3. Live Map Auto-Shows All Valid Stores
No changes needed to the map rendering logic -- once stores have lat/lng populated, they automatically appear on `/live-map` through the existing viewport-culled pin system.

### 4. Geocode Button Behavior
The "Geocode Stores" button on the live map will trigger the function. After each run completes, the store pins refresh automatically. The button can be clicked multiple times to process all 2,800+ stores in batches.

## Technical Details

### Files to Modify

**`supabase/functions/batch-geocode-stores/index.ts`**
- After geocoding, parse Mapbox's `context` array to extract:
  - Street: from `feature.text` + `feature.address` (house number)
  - City: from context entry starting with `place`
  - State: from context entry starting with `region`
  - ZIP: from context entry starting with `postcode`
- Update the store record with all normalized fields plus lat/lng
- Accept optional `revalidate` body parameter to re-process stores that already have coordinates
- Skip stores with clearly invalid addresses (e.g., "No address", empty strings, single characters)

**`src/pages/delivery/LiveMapCommandCenter.tsx`**
- Pass `{ revalidate: false }` in the geocode handler body by default
- After geocoding completes, show count of validated vs failed stores in the toast

### Address Parsing Logic from Mapbox Response
```text
Mapbox feature response:
  feature.text = "Rockaway Parkway"
  feature.address = "1403"
  feature.place_name = "1403 Rockaway Parkway, Brooklyn, New York 11236, United States"
  feature.context = [
    { id: "postcode.123", text: "11236" },
    { id: "place.456", text: "Brooklyn" },
    { id: "region.789", text: "New York" },
    ...
  ]

Extracted:
  address_street = "1403 Rockaway Parkway"
  address_city = "Brooklyn"
  address_state = "New York"
  address_zip = "11236"
  lat/lng from feature.center
```

### Invalid Address Handling
Stores that fail geocoding (Mapbox returns no results) will be:
- Skipped for lat/lng (no fake coordinates)
- Logged with the raw address for ops review
- Counted in the response as `failed` with a breakdown

