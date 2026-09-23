# Upper Manhattan area clarity

## Goal
Keep Washington Heights, Dyckman, Inwood, Harlem, and Manhattan visibly distinct while preserving Manhattan as Naeem’s broader access boundary.

## Changes
- Keep the existing territory permissions unchanged: Naeem’s Manhattan coverage continues to authorize Dyckman and Inwood without creating new assignments.
- Preserve each record’s source-facing area label in the store list and map; never display Dyckman or Inwood as Washington Heights.
- Add a compact Upper Manhattan breakdown where landscape counts are shown, with separate rows for Washington Heights, Dyckman, and Inwood.
- Keep Harlem separately visible and explain that neighborhood rows are included in the Manhattan overall total rather than added again.
- Derive all displayed counts from the already territory-scoped operational and prospect results; do not hardcode audited values.

## Technical details
- Introduce a small shared area-label/count helper so list and map use identical labels and unique-record counting.
- Prefer the source neighborhood label for operational stores and the source city/neighborhood label for prospects; use canonical area only for permission scope, not display relabeling.
- Do not alter the prospect lookup, alias table, assignments, promotions, metrics, authentication, or invite flows.
- Verify Naeem’s scoped records and counts, distinct labels, Manhattan non-duplication, and unchanged Existing Store versus Prospect behavior.

## Expected database impact
None. This is a presentation-only clarification using existing scoped results.
