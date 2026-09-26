# Plan: Preserve original source description in DD bulk-upload drafts

## Problem

When a supplier uploads a spreadsheet, the `description` column they typed is overwritten by AI during processing. The draft row submitted to the admin review queue stores only `ai_description` (in `copy.short_description` / `copy.long_description`). The original spreadsheet description and the full raw row are held in React state only and never written to the database, so if AI generates a different description, the supplier's original text is permanently lost.

## Change

Add the original source data to the draft's existing `copy` JSONB field during `publishItems`. No schema change, no new column, no migration — `copy` is already JSONB and already stores arbitrary keys.

### File: `src/components/wholesaler-console/BulkUploadModule.tsx`

In the `publishItems` insert (~line 327), extend the `copy` object:

```js
copy: {
  title: item.ai_name,
  short_description: item.ai_description,
  long_description: item.ai_description,
  category_guess: item.ai_category,
  subcategory: item.ai_subcategory,
  source_description: item.description,        // original spreadsheet description
  source_product_name: item.product_name,      // original spreadsheet name (pre-AI)
  source_raw_data: item.raw_data,              // full parsed spreadsheet row
},
```

`item.description` is the original spreadsheet `description`/`desc`/`Description` value captured during `mapRow` (line 122). `item.raw_data` is the entire parsed row (line 134). `item.product_name` is the pre-AI name (line 121).

### What does NOT change

- The active description submitted to the draft remains `ai_description` (AI output, or the spreadsheet text as fallback when AI returns nothing). This is the text the admin sees as the product description.
- The AI categorization flow, the `dd_enforce_self_serve_review` trigger, the review queue status, and the admin review UI are untouched.
- No database migration, no new table, no schema change.
- No publish.

## Verification

- Typecheck clean.
- Read-only query: after a test submission, confirm `copy->>'source_description'` and `copy->>'source_raw_data'` are populated on the draft row, while `copy->>'short_description'` still holds the AI description.
