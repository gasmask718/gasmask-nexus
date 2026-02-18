

# Add "AI TESTING" Store Record

## Overview
Insert a fully detailed test store into the `store_master` table for testing the AI voice agent on the `/communication/agents` page. The store will have the phone number **+1 848 400 4179** and realistic placeholder details.

## Database Insert
A single row will be inserted into `store_master` with:

| Field | Value |
|-------|-------|
| store_name | AI TESTING |
| phone | +18484004179 |
| address | 1 Test Plaza |
| city | New York |
| state | NY |
| owner_name | AI Test Admin |
| health_status | active |

All other nullable fields will use sensible defaults or NULL.

## No Code Changes Required
The store will automatically appear in the paginated table on `/communication/agents` since the existing `useStoreCallTable` hook queries all non-deleted stores from `store_master`.

