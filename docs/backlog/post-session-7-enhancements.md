# Post-Session-7 Enhancement Backlog

Parked ideas — out of scope for Session 7 build. Revisit after end-to-end loop ships.

- **Approval audit log** — Persistent log of who approved/rejected each `pending_route_stops` row, with timestamp + reason.
- **RLS for `pending_route_stops` queue** — Already specified in Step 6; verify policies exist before duplicating work.
- **Owner notification → driver** — Push/SMS to assigned driver when owner approves a pending stop.
- **Reschedule + refund flow** — Driver-initiated reschedule path with optional refund hook into invoice ledger.
- **Campaign → route analytics** — Attribution dashboard tying Bland AI campaign IDs to delivered tubes / revenue.

## Implausible Price-Per-Tube Outlier Validator

**Status:** Backlogged from Session 7 Step 3.5

**Issue:** Some invoices produce implied $/tube values that are
operationally impossible (e.g., Moe Deli has one invoice with $200 total
and tube_count=1, implying $200/tube).

**Likely causes:**
- tube_count data entry error (should be 100, not 1)
- Non-tube line item incorrectly attributed
- Import edge case

**Proposed fix:**
Add validation rule:
- If implied_price_per_tube > $5 → flag as outlier
- If implied_price_per_tube < $0.50 → flag as outlier
- Surface flagged invoices in admin tools for operator review

**Priority:** Low (currently degrades confidence rating for affected
stores but doesn't break operations)
