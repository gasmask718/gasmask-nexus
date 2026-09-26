# Anna 25-Product Batch — Flag Investigation (Read-Only)

## What the inspection found

**1. Where flags come from**
- Flags are set by the AI categorization step (`ai-categorize-products`), not by any rule in the importer.
- The AI is instructed to flag an item when it is "ambiguous or possibly a duplicate" and to return a free-text `flag_reason`.
- The importer (`BulkUploadModule.tsx`) just displays whatever the AI returned — it never flags items itself.

**2. The 25-item batch is NOT in the database yet**
- `dd_catalog_drafts` contains only the earlier 3-item test batch (Glass Hand Pipe $5, Glass Water Pipe $25, 9mm Water Pipe $22), all `pending_admin_review`, all Anna's.
- The 25-item batch still lives in the browser's Review & Edit screen. Drafts are only written when "Submit" is clicked.
- `dd_catalog_drafts` has no `flag_reason` column — flag reasons are never saved to the database. They exist only on screen.

**3. Consequences for the three flagged items**
- "14\" Male Mushroom Head Glass Bowl" and both "14mm Grenade Ash Catcher — $8" rows: their exact AI flag reasons cannot be read from the database or code — only from the Review & Edit screen, where the reason is displayed under each flagged item.
- The two identical "14mm Grenade Ash Catcher — $8" rows are the most likely reason the AI flagged them: the AI sees the batch as a list and flags suspected duplicates. The importer itself does no deduplication and drops no rows.
- Whether they are genuinely two distinct source products/SKUs can only be determined from Anna's original spreadsheet, which is not available in this chat.

**4. Other flags in the batch**
- Cannot be enumerated from the database for the same reason (batch not submitted, flags not persisted). Only the on-screen Review & Edit list shows them.

## Proposed next step (read-only)

Option A: User reads the flag reason text shown under each flagged item on the Review & Edit screen and pastes it here — fastest, zero changes.

Option B: User uploads Anna's original Excel file to this chat; I list all 25 rows (names, categories, costs, image counts), confirm whether the two Grenade Ash Catchers are distinct SKUs/rows, and cross-check which items the AI would have flagged.

No code or data changes are proposed. Nothing will be accepted, rejected, submitted, modified, or published.
