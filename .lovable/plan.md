

# Phase: Fix Biker Portal Location Pipeline

## Problems Found

### Problem 1: Location writes from the Biker Portal SILENTLY FAIL
The `LiveLocationMap` component (used in the biker portal's MyDayDashboard) inserts location events with `event_type: 'live_tracking'`. But the database constraint only allows: `'arrival', 'departure', 'idle', 'gps_ping'`. Every GPS write from the portal is rejected and the error is swallowed silently.

### Problem 2: Admin cannot read biker location data (RLS blocks it)
The `BikerLocationPreview` on `/delivery/bikers/:id` queries `location_events` for the biker's `user_id`. But the RLS policy only allows `auth.uid() = user_id` -- meaning only the biker themselves can see their own location. An admin viewing the profile page gets zero results.

### Problem 3: Biker-to-User ID linkage is often missing
Many bikers in the `bikers` table have `user_id = NULL`. The `ensureBikerRecord` in `PortalAuthGuard` tries to auto-heal this on portal login, but the `BikerLocationPreview` needs the `user_id` to query `location_events`. If the linkage doesn't exist, no location is found.

### Problem 4: No portal login detection signal
There's no explicit "biker is online" signal. The only indicator is whether recent `location_events` exist, but since those writes fail (Problem 1), the admin side never sees the biker as active.

---

## Fix Plan

### Fix 1: Update the DB constraint to allow 'live_tracking'
Add a migration that drops and re-creates the `event_type_check` constraint to include `'live_tracking'` alongside the existing allowed values.

### Fix 2: Add an admin-readable RLS policy on `location_events`
Add a SELECT policy that allows users with admin/owner/va/ceo roles (looked up from `user_profiles` or `user_roles`) to read all location events. This keeps the existing self-read policy intact.

### Fix 3: Fix the `LiveLocationMap` to log on first position (not just every 30s)
Currently the first GPS log only happens after 30 seconds. Change it to also log immediately on first position acquisition so the admin sees data right away.

### Fix 4: Add a `portal_session_active` event on portal login
When a biker logs into the portal, insert a location event with `event_type: 'gps_ping'` (or a new allowed type) so the admin side can detect the biker is online even before GPS coordinates arrive.

---

## Technical Details

### Migration SQL
```sql
-- Allow 'live_tracking' in event_type
ALTER TABLE public.location_events DROP CONSTRAINT location_events_event_type_check;
ALTER TABLE public.location_events ADD CONSTRAINT location_events_event_type_check
  CHECK (event_type = ANY (ARRAY['arrival','departure','idle','gps_ping','live_tracking']));

-- Admin can read all location events
CREATE POLICY "Admins can view all location events"
ON location_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.primary_role IN ('admin','owner','ceo','va')
  )
  OR
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin','owner','dynasty_owner','super_admin')
  )
);
```

### Code Changes

**`src/components/map/LiveLocationMap.tsx`**
- Log location immediately on first GPS fix (not just every 30 seconds)
- Change `event_type` from `'live_tracking'` to `'gps_ping'` as a fallback-safe option (or keep `'live_tracking'` since the constraint will be updated)

**`src/components/portal/PortalAuthGuard.tsx`**
- After successful auth guard pass, fire an initial `location_events` insert with `event_type: 'gps_ping'` and null lat/lng as a "session start" signal, so the admin side knows the biker is online

**`src/components/map/BikerLocationPreview.tsx`**
- Add `'live_tracking'` to the event types it looks for (already queries all types, so this works automatically once data flows)
- Add a "Last seen" freshness indicator (e.g., green = <5min ago, yellow = <30min, gray = older)

### Files to modify
1. New migration SQL (constraint + RLS policy)
2. `src/components/map/LiveLocationMap.tsx` -- immediate first log
3. `src/components/portal/PortalAuthGuard.tsx` -- session start signal
4. `src/components/map/BikerLocationPreview.tsx` -- freshness indicator

### No breaking changes
- Existing location reads/writes unaffected
- Existing RLS self-read policy preserved
- BikerLocationPreview already handles missing data gracefully
