

# Fix: territory_addresses_address_type_check Constraint Violation

## Root Cause

The `territory_addresses` table has a database CHECK constraint:
```
address_type IN ('commercial', 'residential', 'unknown')
```

The Yelp ingestion code (line 105 of `YelpBusinessSearch.tsx`) sets `address_type` to the Yelp category names joined by comma (e.g., `"Tobacco Shops, Vape Shops"`), which is not one of the three allowed values.

## Fix

In `src/components/territory/YelpBusinessSearch.tsx`, change line 105:

**Before:**
```typescript
address_type: b.categories.map(c => c.title).join(', '),
```

**After:**
```typescript
address_type: 'commercial',
```

Since all Yelp businesses are commercial establishments, `'commercial'` is the correct value. The category details are already captured in the `notes` field alongside the business name, rating, and phone number -- but we should also append categories there for visibility:

**Updated notes field (line 106):**
```typescript
notes: `${b.name} | ${b.categories.map(c => c.title).join(', ')} | Rating: ${b.rating}/5 (${b.review_count} reviews) | ${b.display_phone}`,
```

## Summary
- One file changed: `src/components/territory/YelpBusinessSearch.tsx`
- Two lines modified (105-106)
- No database migration needed
