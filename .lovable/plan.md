

# Search History and Enhanced Auto-fill for Yelp Business Search

## Overview
Enhance the `/territory/ingestion` Yelp search page with two improvements: (1) ensure business name autocomplete always auto-fills the location field, and (2) add persistent search history that appears when the input fields are empty/focused.

## Changes

### 1. Search History Hook (`src/hooks/useSearchHistory.ts`)
A small utility hook that reads/writes search history to `localStorage`.

- Stores up to 10 recent searches as `{ term, location, timestamp }` objects
- Key: `yelp-search-history`
- Provides `addSearch(term, location)` and `history` array
- Most recent searches appear first
- Deduplicates by term+location combo

### 2. Update `YelpSearchAutocomplete.tsx`
- Accept a new `searchHistory` prop (array of past search terms)
- On focus, if the input is empty, show recent business name searches as suggestions under a "Recent Searches" header with a clock icon
- When user starts typing, switch to live Yelp autocomplete results as before
- When a business with location data is selected, fire `onBusinessSelect` (already wired to auto-fill location)

### 3. Update `LocationAutocomplete.tsx`
- Accept a new `searchHistory` prop (array of past location strings)
- On focus with empty input, show recent locations under a "Recent Locations" header
- When user starts typing, switch to live Mapbox suggestions

### 4. Update `YelpBusinessSearch.tsx`
- Import and use `useSearchHistory` hook
- Pass history data down to both autocomplete components
- After a successful search, call `addSearch(term, location)` to persist the search
- Both fields now show relevant history on focus when empty

## Technical Notes
- All history is stored client-side in localStorage -- no database changes needed
- History entries are capped at 10 to keep the dropdown clean
- The location auto-fill from business selection already works via `onBusinessSelect`; no change needed there
