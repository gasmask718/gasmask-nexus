# Ambassador Portal Mobile UX Audit + Fix

## Audit findings

- **New Stores clipping:** `MyWorkStoreList` uses a Radix `ScrollArea` with only `max-h-72`. Its viewport expects a defined height while the root clips overflow, so longer lists can become visually clipped without a reliable touch-scroll area.
- **Back/scroll reset:** no global scroll-restoration system exists. Detail links do not record the origin scroll/card, and `useReturnNavigation` can create a fresh navigation to `state.from`, remounting the origin at the top. Async list rendering makes native browser restoration unreliable.
- **Leads extra navigation:** the four-count row is an intended lead-category selector, not portal navigation. It duplicates the actual category tabs immediately below it, which makes the page look like it has a second navigation bar.

## Changes

1. **Make My Work lists fully reachable**
   - Keep a short dashboard preview for both “Handled by Me” and “New Stores I Added.”
   - Add count-aware **View All** actions when a list exceeds the preview.
   - Add/use “Added by Me” and “Handled” views on My Stores, backed by the existing `useMyAddedStores` and `useMyHandledStores` queries.
   - Remove the unreliable fixed/max-height `ScrollArea` behavior from these canonical work lists; full views render every matching record.

2. **Restore exact portal origin on Back**
   - Extend the existing safe return-navigation state to carry the origin path, window scroll position, and originating section/card identifier.
   - Restore that position only when returning from a detail page; normal Dashboard/Home navigation still starts normally.
   - Add stable anchors to My Work, My Portfolio, store lists, and lead/contact rows, and preserve the active portfolio/list category when relevant.
   - Keep all detail destinations and fallbacks under `/ambassador/...` while in portal context.

3. **Clarify Leads categories**
   - Remove the duplicate KPI-card selector row.
   - Restyle the real category tabs as a clearly titled “Lead categories” control above the lead list, retaining all four counts and an unmistakable active state.
   - Use a touch-friendly mobile layout that reads as page filtering, while leaving the persistent bottom navigation as the only bottom navigation.

## Technical scope

Expected frontend files include:
- `src/components/ambassador/MyWorkSection.tsx`
- `src/pages/ambassador/AmbassadorStoresList.tsx`
- `src/components/ambassador/PortfolioSection.tsx`
- `src/pages/ambassador/AmbassadorDashboard.tsx`
- `src/pages/ambassador/AmbassadorLeads.tsx`
- `src/hooks/useReturnNavigation.ts`
- `src/components/ambassador/AmbassadorLayout.tsx`
- Ambassador portal list/detail link callers identified during implementation

No database, role, territory, assignment, lead/store record, commission, auth, or invite changes. No publish.

## Verification

- Verify on authenticated desktop and mobile viewports:
  - Dashboard preview shows the correct counts and View All reaches all current-user records.
  - Dashboard → Added/Handled detail → Back restores the originating section/card.
  - My Portfolio and Wholesaler Leads detail returns restore category and position.
  - explicit Home/Dashboard navigation is unaffected.
  - Leads has one persistent bottom navigation and one clearly separate category filter.
  - all tested detail routes remain inside the Ambassador Portal.
