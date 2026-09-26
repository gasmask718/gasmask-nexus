# Supplier spreadsheet import: why it isn't showing, and an optional fix

## Findings (checked, nothing changed)
1. **Anna's account:** the import is turned on for her. Her account is verified, and the import page finds her supplier profile.
2. **Where it is:** it's on a different page. Go to Products, tap "Add product" or "Quick Add by Photo" to open the photo screen, then tap the small grey link **"Upload a spreadsheet instead"**. You can also open the page directly: `/portal/wholesaler/catalog/onboard?mode=spreadsheet`.
3. **Switched off for everyone?** No. The platform-wide "Wholesaler Self-Serve" switch is ON (last changed 2026-06-17).
4. **Setting that needs turning on?** No. The only switch involved is Self-Serve, and it's already on.

**Why you didn't see it:** the Products page has no spreadsheet button. The only way in is a small link on the photo screen, and it's easy to miss.

## Optional change (only if you approve)
- Add a visible **"Import spreadsheet (CSV/Excel)"** button on the supplier Products page. It opens the spreadsheet import that already exists.
- Nothing else changes: no settings, products, review queue, or permissions. Imported items still wait in admin review.

## Technical
- File: `src/pages/portal/wholesaler/WholesalerProducts.tsx`. Add a Link to `/portal/wholesaler/catalog/onboard?mode=spreadsheet` next to the existing buttons.
