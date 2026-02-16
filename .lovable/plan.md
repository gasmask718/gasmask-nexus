

# Plan: Unify Biker & Driver Portal Features + "Mark Delivered" Button

## Overview
Synchronize all delivery functionality across both portals and add a prominent "Mark as Delivered" confirmation button that updates all related database records.

---

## Changes

### 1. Add Missing Routes to Biker Portal
The Biker portal is missing the `delivery`, `delivery/:deliveryId`, and `delivery-tasks` routes that the Driver portal has.

**File: `src/pages/portal/BikerPortal.tsx`**
- Import `MakeDeliveryPage` and `BikerDeliveryTasks`
- Add routes: `delivery`, `delivery/:deliveryId`, `delivery-tasks`

### 2. Add "Make Delivery" Nav Item for Bikers
Currently the sidebar only shows "Make Delivery" for drivers.

**File: `src/components/portal/field/PortalSidebar.tsx`**
- Remove the `portalType === 'driver'` guard so both roles see the "Make Delivery" nav item

### 3. Show Delivery Tasks on Both Dashboards
Currently `BikerDeliveryTasks` only renders for bikers in `MyDayDashboard`. Show delivery tasks for both roles.

**File: `src/components/portal/field/MyDayDashboard.tsx`**
- Remove the `portalType === 'biker'` guard on line 413
- Show `BikerDeliveryTasks` for both portal types (it already uses the canonical `useMyAssignedRoutes` hook)
- Add the "Make Delivery" quick action button for bikers (currently driver-only on line 386)

### 4. Add "Mark as Delivered" Button to AssignedOrdersPage
This is the key feature -- a clear button on each delivery task card.

**File: `src/components/portal/field/AssignedOrdersPage.tsx`**
- Import `useUpdateDeliveryTaskStatus` from `useDeliveryTasks`
- Add a confirmation dialog (similar to `BikerDeliveryTasks`) with optional delivery notes
- Add "Mark as Delivered" and "Report Issue" action buttons to each task card
- On confirmation:
  - Update `delivery_tasks.status` to `'delivered'` and set `delivered_at`
  - The existing hook already handles query invalidation for `delivery-tasks` and `biker-delivery-tasks`
- Add status-appropriate action buttons:
  - `assigned` -> "Mark Picked Up"
  - `picked_up` -> "In Transit"
  - `in_transit` -> "Mark Delivered" / "Report Issue"

### 5. Update `useUpdateDeliveryTaskStatus` Hook
Ensure the hook also invalidates `my-assigned-tasks` query so the AssignedOrdersPage refreshes after status changes.

**File: `src/hooks/useDeliveryTasks.ts`**
- Add `queryClient.invalidateQueries({ queryKey: ["my-assigned-tasks"] })` to the `onSuccess` callback
- Add `queryClient.invalidateQueries({ queryKey: ["dispatchable-orders"] })` so admin views also refresh

---

## Technical Details

### Database Flow on "Mark Delivered"
```text
delivery_tasks.status -> 'delivered'
delivery_tasks.delivered_at -> current timestamp
delivery_tasks.delivery_notes -> optional worker notes
```

All queries invalidated:
- `delivery-tasks` (dispatcher view)
- `biker-delivery-tasks` (legacy)
- `my-assigned-tasks` (AssignedOrdersPage)
- `dispatchable-orders` (admin dispatch)
- `my-assigned-routes` (canonical route data)

### No Database Migration Needed
The `delivery_tasks` table already supports the `delivered` status and has `delivered_at`, `delivery_notes` columns. The existing `useUpdateDeliveryTaskStatus` hook handles the update logic correctly.

### Files Changed (5 files)
1. `src/pages/portal/BikerPortal.tsx` -- add missing routes
2. `src/components/portal/field/PortalSidebar.tsx` -- show delivery nav for both roles
3. `src/components/portal/field/MyDayDashboard.tsx` -- show delivery tasks + quick action for both
4. `src/components/portal/field/AssignedOrdersPage.tsx` -- add Mark Delivered UI with confirmation dialog
5. `src/hooks/useDeliveryTasks.ts` -- broaden query invalidation

