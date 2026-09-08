# Account Activity Report — upgrade to a real audit log

## What's there today

`/reports/account-activity` (402 lines) reads one combined feed and shows a flat list: store, actor, kind, one-word note. It caps at today's/recent activity, has no numbering, no expansion, no route info, and no admin-vs-VA split.

## What the data actually supports

| Need | Source | Status |
| --- | --- | --- |
| Review actions with text | `store_notes` (`source='account_review'`) — 1,032 rows over 673 stores | Text is good |
| Who reviewed, admin vs VA | `store_review_events` (`review_type`, `reviewed_by`) — 151 rows over 106 stores | Attribution is here |
| Invoice balance / paid-unpaid | `invoices` — 3,239 rows | Fine |
| Route assignment | `routes` + `route_stops` exist (48 routes, 96 stops). There is no `route_assignments` table | Use routes/route_stops |
| Call/text history + responsiveness | communication logs — ~2,012 rows | Fine |
| Address / name corrections | `audit_log` keeps before/after JSON on `store_master` | Fine |
| Duplicate-invoice fixes | `audit_log` on `invoices` | Fine |

**The one real gap:** every `store_notes.account_review` row has an empty author. The detailed text and the named actor live in two different tables. So a row can have rich text OR a named actor, rarely both today.

## Decisions I'm proposing (say the word if you want it differently)

1. **One merged feed.** Review events and review notes both become rows, matched to each other when they share a store and land within a few minutes, so an attributed event carries its note text where possible. Nothing gets hidden.
2. **Unattributed is shown as "Unattributed", and we start capturing the author going forward** — the review save path stamps the signed-in user from now on. Old rows stay honest rather than being back-filled with guesses.
3. **Corrections are included** (address, store name, duplicate invoice removals) read from the change history.

## Build

**Data layer** — one paged database view/function returning newest-first activity with a stable sort key, so numbering is just offset + index and never resets or shifts as pages load. Row detail is fetched per store on expand, not up front, so the list stays fast.

**Page**
- Numbered rows continuing across pages (1, 2, 3 ... 47 ...), plus "expand all" on the loaded page.
- Expanded panel per row: full note text, invoice summary (open balance, paid vs unpaid counts), route badge (route name, date, delivery/collection/check-up, stop status), call/text history with a responsive / unresponsive / never-contacted flag, and any address, name, or duplicate-invoice fix recorded in that review window.
- Actor column shows Admin / VA / Unattributed as a clear labelled column, with a filter for exactly those.
- Route column/badge on the row itself.
- Infinite scroll (with a "load more" fallback) across all history, not just today. Numbering and filters keep working as pages load.
- Search runs server-side against note text, store name, actor, and correction text — so searching "closed permanently" finds those stores.

**Verification before I hand it back:** load the page signed in, scroll past several pages and confirm numbering stays sequential and correct, expand real rows and check the invoice/route/call figures against the database directly, and confirm the "closed permanently" search actually returns the right stores.

## Notes

- No new tables. No changes to how reviews are performed, only that the author gets recorded from now on.
- Nothing outside this report page changes.
