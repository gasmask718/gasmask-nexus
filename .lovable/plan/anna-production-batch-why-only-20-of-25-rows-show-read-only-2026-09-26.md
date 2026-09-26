# Anna production batch: why only 20 of 25 rows show (read-only findings)

## Findings
1. **All 25 rows were parsed.** The counter "+5 more items" is worked out as the total parsed minus 20, so it only reads 5 when 25 items are loaded. The Excel reader turns every sheet row into an item. It has no row limit and no filter.
2. **Why only 20 show:** the preview table is set to draw just the first 20 rows. "+5 more items" is plain text, not a button, so tapping it does nothing. Rows 21–25 are still loaded, and they go to AI categorization and submission along with the rest. Processing runs in groups of 10 until every row is done.
3. **Parsing errors / dropped rows:** none are possible here. A failed file shows a "Failed to parse file" error and loads nothing. The importer never skips a row. A row with no name gets "Item N" instead of being dropped, and a blank cost shows "—".
4. **Rows 21–25 (names, categories, costs, image counts):** I can't see these yet. The spreadsheet is read inside Anna's browser tab, and nothing is saved until she submits. Her file also isn't in the chat. **Upload the Excel file here** and I'll list rows 21–25 exactly as the importer reads them, without changing anything.

## Optional fix (only if you approve)
Show every row in the Raw Data Preview. The table already scrolls, so this just removes the 20-row limit. You could also make "+N more items" a "Show all" toggle instead.
- Only the preview display changes. Parsing, AI categorization, drafts, review queue and data stay the same. Nothing gets submitted or published.

## Technical
- `src/components/wholesaler-console/BulkUploadModule.tsx` line 482: `rawItems.slice(0, 20)` → `rawItems`. Remove or turn the indicator at lines 494–498 into a toggle.
