

# Smart Autocomplete for Yelp Business Search

## Overview
Add intelligent autocomplete to both the "Business Name / Keyword" and "Location" fields in the Yelp search form at `/territory/ingestion`. When a business name is recognized, automatically suggest its location.

## How It Works

**Business Name Field:**
- As user types (debounced 300ms), calls Yelp's `/v3/autocomplete` endpoint which returns matching businesses, categories, and terms
- Dropdown shows business name suggestions with their city/state
- Selecting a business auto-fills the location field with that business's city + state

**Location Field:**
- Uses Mapbox Geocoding API (already configured via `VITE_MAPBOX_PUBLIC_TOKEN`) for place autocomplete
- As user types, suggests cities/states/neighborhoods
- No external dependency needed -- Mapbox token is already in the project

## Changes

### 1. Update Edge Function (`yelp-business-search`)
Add a new `autocomplete` action that calls `GET https://api.yelp.com/v3/autocomplete?text=X&locale=en_US`. Returns business names with locations, category matches, and term suggestions.

### 2. New Component: `YelpSearchAutocomplete.tsx`
A reusable autocomplete input component with:
- Debounced input (300ms) to avoid excessive API calls
- Dropdown with grouped results (Businesses, Categories, Terms)
- Business results show name + city for quick identification
- Click-outside-to-close behavior
- Keyboard navigation not required for MVP but structure supports it

### 3. New Component: `LocationAutocomplete.tsx`
A location-specific autocomplete using Mapbox's geocoding API (client-side, no edge function needed):
- Calls `https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json?types=place,locality,neighborhood`
- Shows city/state suggestions as user types
- Selecting a suggestion fills the location field

### 4. Update `YelpBusinessSearch.tsx`
Replace the two plain `<Input>` fields with the new autocomplete components:
- Business field uses `YelpSearchAutocomplete` -- on selecting a business suggestion, auto-populates location
- Location field uses `LocationAutocomplete` -- independent city/state search
- Search button and all existing functionality unchanged

## Technical Notes
- Yelp autocomplete endpoint: `GET /v3/autocomplete?text=...&locale=en_US` -- returns `{ businesses, categories, terms }`
- Mapbox geocoding is already used in `src/services/geocoding.ts` with `VITE_MAPBOX_PUBLIC_TOKEN`
- Both autocomplete dropdowns dismiss on blur/click-outside and on item selection
- No database changes required
