
# Fix: Stores Being Skipped Due to Empty String Addresses

## Root Cause
The database has **1,105 stores** where `address_street` is an empty string `""` (not NULL). The current query only filters out NULL values, so these empty strings are fetched, counted toward the 1,000 row limit, and then skipped by the validation logic -- meaning real addresses never get processed.

## The Fix

### `supabase/functions/batch-geocode-stores/index.ts`
Add a filter to exclude empty strings from the query, so only stores with actual address text are fetched:

- Add `.neq('address_street', '')` to the query chain (right after `.not('address_street', 'is', null)`)
- This ensures the 1,000-row limit is used entirely for stores that have real addresses (1,698 stores with actual data)

That single line change will make the function process real addresses instead of burning through its limit on empty ones.

### Breakdown After Fix
- **1,698 stores** with real address text will be fetched and geocoded
- **1,105 empty-string stores** excluded at the query level
- **8 NULL stores** excluded at the query level
- Two runs of the geocode button will cover all 1,698 geocodable stores
