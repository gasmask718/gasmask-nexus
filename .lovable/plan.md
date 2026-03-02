

# Add Phone Numbers to Territory Ingestion

## Problem
The Yelp API returns phone numbers for every business (`phone` and `display_phone`), but the `territory_addresses` table has no `phone` column. Currently, the phone is only embedded in the `notes` text field and is not queryable or visible on the map.

## Changes

### 1. Database Migration -- Add `phone` column to `territory_addresses`
- Add `phone TEXT NULL` to the `territory_addresses` table
- This is a non-breaking additive change

### 2. Update Yelp Ingestion (`YelpBusinessSearch.tsx`)
- In the `buildRecords` function (line ~140-153), add `phone: b.phone || b.display_phone || null` to the record object being built
- This ensures every Yelp-ingested address saves its phone number to the new column

### 3. Update Map View (`TerritoryMapView.tsx`)
- Add `phone` to the select query (line ~145)
- Add `phone` to the `TerritoryAddress` interface
- Display the phone number in map marker popups (where store details appear)

### 4. Update Duplicate Resolution Handler
- When updating existing territory records via the duplicate modal, include `phone` in the update payload so re-ingested records also get their phone populated

---

### Technical Details

**Migration SQL:**
```sql
ALTER TABLE public.territory_addresses ADD COLUMN phone TEXT;
```

**`buildRecords` change:**
```typescript
// Add phone field to each record
phone: b.phone || b.display_phone || null,
```

**Map popup enhancement:**
The marker popup HTML will include a phone line when available, displayed with a phone icon.

