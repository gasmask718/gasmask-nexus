## Phase 1: TopTier Experience Hub Rebuild

### Database Migration
Create the missing TopTier-specific tables needed for Phase 1:
- `tt_bookings` — client bookings with service_type, total_price, status, partner assignment
- `tt_partners` — service partners with trust_score, status, response_rate
- `tt_confirmation_requests` — partner confirmation tracking
- `tt_booking_events` — timeline/audit log for booking status changes
- `tt_partner_earnings` — partner payout tracking
All with RLS policies for authenticated users.

### New Layout: TopTierHubLayout
- Fixed left sidebar (240px) with dark luxury theme (#0A0A0A background, gold #C9A84C accents)
- Dynasty OS logo, TopTier Hub navigation (9 items), live status indicator
- Top header bar with breadcrumb, live clock, notifications, LIVE badge
- Replaces current simple TopTierDashboard for `/os/toptier/*` routes

### Page 1: Overview Dashboard (`/os/toptier`)
- 4 KPI cards (Revenue Today, Active Bookings, Partners Active, Pending Issues) — live from Supabase
- Live Booking Feed (Realtime subscription) + Revenue 7-day area chart
- 3 status cards (Partner Response Rate, Top Service, Ambassador Activity)
- Operations alerts section

### Page 2: Bookings Manager (`/os/toptier/bookings`)
- Filter row (date range, status, service type, search)
- 5 metric cards from filtered data
- Sortable paginated table with slide-over detail panel
- Actions: Reassign, Complete, Refund, Add Note

### Page 3: Revenue Dashboard (`/os/toptier/revenue`)
- Date range selector with 6 presets
- 6 top metric cards
- Revenue + Bookings charts (AreaChart + BarChart)
- Revenue by category (PieChart) + Top services (horizontal bar)
- Partner payout queue table

### Routing Changes
- Add nested routes under `/os/toptier/*` inside existing AppRoutes
- Keep existing TopTier module sidebar items working
- New pages are lazy-loaded

### Design System
- Add TopTier dark theme CSS variables to index.css scoped under `.toptier-hub`
- All components use semantic tokens, no hardcoded colors
- Gold accents, dark glass cards, no white backgrounds
