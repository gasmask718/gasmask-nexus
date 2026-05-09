# Post-Session-7 Enhancement Backlog

Parked ideas — out of scope for Session 7 build. Revisit after end-to-end loop ships.

- **Approval audit log** — Persistent log of who approved/rejected each `pending_route_stops` row, with timestamp + reason.
- **RLS for `pending_route_stops` queue** — Already specified in Step 6; verify policies exist before duplicating work.
- **Owner notification → driver** — Push/SMS to assigned driver when owner approves a pending stop.
- **Reschedule + refund flow** — Driver-initiated reschedule path with optional refund hook into invoice ledger.
- **Campaign → route analytics** — Attribution dashboard tying Bland AI campaign IDs to delivered tubes / revenue.
