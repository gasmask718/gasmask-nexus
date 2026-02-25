

# Yelp Places API Integration Plan

## Overview
Integrate Yelp Fusion API into the Territory Ingestion Wizard to enable direct business search by name, detailed business info viewing, review browsing, and selective data ingestion into your territory system.

## Current State
- An `ingest-yelp` edge function already exists for bulk neighborhood-scoped ingestion
- The `YELP_API_KEY` secret is **not yet configured** -- needs to be added
- The ingestion page at `/territory/ingestion` supports Yelp as a source but only for bulk area-based ingestion, not individual business search

## What Changes

### 1. Store Yelp API Key as Secret
Add `YELP_API_KEY` to your backend secrets so the edge function can authenticate with Yelp.

### 2. New Edge Function: `yelp-business-search`
A single edge function handling three operations via an `action` parameter:

- **`search`** -- Search businesses by name/term + location. Returns list with name, address, rating, review count, categories, phone, image.
- **`details`** -- Get full business details by Yelp business ID (hours, photos, price level, transactions, etc.)
- **`reviews`** -- Get up to 3 reviews per business (Yelp API limit) with reviewer name, rating, text, and date.

### 3. Enhanced Ingestion Wizard UI
When "Yelp Fusion" source is selected, a new **search-first workflow** replaces the current scope form:

**Search Panel:**
- Text input for business name/keyword (e.g., "Smoke Shop")
- Location input (city, state)  
- Search button that calls the edge function
- Results grid showing business cards with: name, address, rating stars, review count, categories, thumbnail

**Business Detail Drawer:**
- Click a result to see full details + reviews in a slide-out panel
- Business info: hours, phone, price level, photos
- Reviews section: up to 3 Yelp reviews with rating, text, date
- "Ingest This Business" button to add to territory_addresses

**Batch Select + Ingest:**
- Checkbox on each search result card for multi-select
- "Ingest Selected (N)" button to batch-insert chosen businesses into `territory_addresses`
- Deduplication check against existing addresses before insert

### 4. Data Flow

```text
User types search term + location
        |
        v
Frontend calls yelp-business-search (action: search)
        |
        v
Results displayed as cards with checkboxes
        |
   [Click card]          [Select + Ingest]
        |                       |
        v                       v
yelp-business-search      Insert selected into
(action: details)         territory_addresses
(action: reviews)         via existing supabase
        |                 client insert
        v
Detail drawer with
reviews displayed
```

## Technical Details

### Edge Function: `supabase/functions/yelp-business-search/index.ts`
- Uses `YELP_API_KEY` from `Deno.env.get()`
- Endpoints hit:
  - `GET https://api.yelp.com/v3/businesses/search?term=X&location=Y&limit=20`
  - `GET https://api.yelp.com/v3/businesses/{id}`
  - `GET https://api.yelp.com/v3/businesses/{id}/reviews?limit=3&sort_by=yelp_sort`
- Standard CORS headers + error handling per edge function pattern

### Frontend Components
- **`src/components/territory/YelpBusinessSearch.tsx`** -- Search form + results grid with select/ingest controls
- **`src/components/territory/YelpBusinessDetail.tsx`** -- Detail drawer with reviews panel
- **Modified `src/pages/territory/TerritoryIngestion.tsx`** -- When `source === 'yelp'` and `step === 'scope'`, render the new Yelp search UI instead of the generic scope form

### Ingestion into `territory_addresses`
Each ingested business creates a record with:
- `full_address`: from Yelp location data
- `city`, `state`, `zip`: from Yelp
- `latitude`, `longitude`: from Yelp coordinates
- `address_type`: Yelp categories joined
- `notes`: business name, rating, review count, phone
- `discovery_status`: 'unknown'
- `discovered_by`: 'yelp'
- Dedup check on address + city before insert

