# Ambassador Portal Mobile Shell Consistency Fix

## Audit findings

- Leads, Home, and My Stores already share `AmbassadorLayout` and the same five-item bottom navigation.
- Shared content reserves a fixed `pb-20`, but does not add `safe-area-inset-bottom`; on iPhones the last content can remain under the nav.
- Shared phone/help controls use fixed `bottom-20` offsets without the safe-area inset.
- Home adds a third fixed “Capture New Store” control at `bottom-6 right-6`, directly over the navigation and in the same corner as Help.
- My Stores contains intentionally scrollable wide table/tab regions, but its page and shared shell do not strictly contain horizontal overflow.
- The shared top portal strip uses a negative horizontal margin larger than the mobile page gutter, allowing a small viewport-width escape.

## Changes

1. **Harden the shared mobile shell**
   - Constrain the portal page to the viewport and prevent document-level horizontal scrolling.
   - Reserve bottom space equal to the mobile navigation, floating-control row, and iPhone safe-area inset.
   - Keep desktop spacing unchanged.

2. **Keep all five navigation items visible**
   - Make the fixed navigation explicitly viewport-width, safe-area aware, and width-constrained.
   - Keep the same destinations, labels, active states, and single navigation instance.

3. **Move floating controls above the navigation**
   - Position Phone and Help using the shared safe-area-aware offset.
   - Move Home’s Capture New Store control into the same above-nav control row without covering Help or any navigation item.
   - Preserve all existing actions and dialogs.

4. **Contain My Stores scrollers**
   - Keep its table and tab row internally scrollable where needed.
   - Ensure those regions cannot widen the page or clip the fixed navigation.

## Scope and verification

- Frontend mobile layout only; no route, data, metrics, handled/new-store, lead, territory, auth, commission, or destination changes.
- Verify Home, My Stores, and Leads at mobile width for five visible navigation items, no page-level horizontal scroll, fully reachable last content, and non-overlapping controls.
- Verify desktop layout remains unchanged.
- No publish.
