
# Things To Do — Marketplace Backend Control System

## Phase 1: Database Schema
Create two new tables with RLS:
- **`experiences_master`** — title, description, city, category, price, rating, duration, supplier_name, booking_type, external_url, markup_pct, display_price
- **`experience_bookings`** — user_id, experience_id, selected_addons (JSONB), total_price, booking_status, created_at
- Enable realtime on `experience_bookings` for instant OS updates

## Phase 2: API Sync Edge Function
- Create `fetch-experiences` edge function
- Pulls from Viator API (will need API key via secrets tool)
- Normalizes and upserts into `experiences_master`
- Tracks failed API calls with error logging

## Phase 3: Pricing Engine
- Admin-configurable markup % stored per experience or globally
- `display_price` = `price * (1 + markup_pct/100)` via generated column
- Support category/city/supplier-level markup overrides

## Phase 4: OS Dashboard Pages
- **Experience Management** — CRUD table for all experiences, inline edit, "Sync Experiences" button
- **Booking Management** — Real-time booking list with status workflow (pending → confirmed → completed)
- **Upsell Analytics** — Add-on selection tracking & revenue breakdown

## Phase 5: Wiring & Navigation
- Add "Things To Do" section to appropriate OS hub/floor
- Wire routes and sidebar navigation

## Notes
- Viator API key will be requested via secrets tool
- Realtime enabled for bookings table
- RLS: authenticated admins can manage; service_role for API sync
