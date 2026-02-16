

# Plan: Smart Assignment with Availability Filtering + Accept/Decline Workflow

## Overview
Three changes to `/grabba/assignments`:
1. Only show workers who are **truly available** (active status AND not currently on a delivery)
2. Add `pending_acceptance` status so workers can **accept or decline** assignments
3. **Notify admins** when a worker declines, so they can reassign

---

## Changes

### 1. Filter Workers by Real Availability (GrabbaAssignments.tsx)

Currently the page fetches bikers/drivers with `status = 'active'` but does not exclude those already on an active delivery. We will:

- After fetching active bikers/drivers, also fetch `delivery_tasks` with status IN (`assigned`, `picked_up`, `in_transit`, `pending_acceptance`) to identify busy workers
- Filter out any biker/driver who already has an active task
- Show a small availability indicator (badge) next to each worker in the dropdown

### 2. New Status: `pending_acceptance` (Database Migration)

Add a new step to the delivery lifecycle:
- When admin assigns an order, status starts as `pending_acceptance` instead of `assigned`
- Worker sees the task in their portal with **Accept** / **Decline** buttons
- Accept changes status to `assigned` (existing flow continues)
- Decline changes status to `declined`

**Migration SQL:**
- No constraint changes needed (delivery_tasks.status is a plain `text` column with no check constraint)

### 3. Accept/Decline UI in Worker Portal (AssignedOrdersPage.tsx)

Update the `STATUS_FLOW` map and the task query:
- Fetch tasks with status `pending_acceptance` in addition to existing statuses
- Add new flow entry: `pending_acceptance` -> Accept (`assigned`) or Decline (`declined`)
- Decline requires a reason (notes field)
- On decline, insert a row into `internal_notifications` targeting `admin` role with details about which order was declined and by whom

### 4. Admin Notification on Decline (AssignedOrdersPage.tsx + GrabbaAssignments.tsx)

- When a worker declines, insert into `internal_notifications`:
  - `title`: "Delivery Declined"
  - `message`: "[Worker Name] declined order [Order Number]. Reason: [notes]"
  - `target_role`: "admin"
  - `entity_type`: "delivery_task"
  - `entity_id`: task ID
- On the GrabbaAssignments page, show a visual indicator on orders with `declined` tasks so admin can quickly reassign

### 5. Update useDeliveryTasks Hook

- Update `useCreateDeliveryTask` to set initial status to `pending_acceptance`
- Add query invalidation for `assignment-tasks` on status updates

---

## Technical Details

### Files Modified (4 files)

1. **`src/pages/grabba/GrabbaAssignments.tsx`**
   - Filter bikers/drivers by cross-referencing active delivery_tasks
   - Show availability badge in worker dropdown
   - Change initial assignment status from `assigned` to `pending_acceptance`
   - Show "Declined" badge on orders where task was declined
   - Allow re-assignment of declined tasks

2. **`src/components/portal/field/AssignedOrdersPage.tsx`**
   - Add `pending_acceptance` to the fetched statuses
   - Add Accept/Decline buttons for `pending_acceptance` tasks
   - On Decline: update status + insert `internal_notifications` row
   - Decline requires a reason in the notes field

3. **`src/hooks/useDeliveryTasks.ts`**
   - Update `useCreateDeliveryTask` default status to `pending_acceptance`
   - Add `assignment-tasks` to invalidated queries

4. **`src/hooks/useLiveMapData.ts`**
   - Add `pending_acceptance` to the active task statuses filter so the live map reflects pending tasks

### Status Flow Diagram

```text
Admin assigns order
        |
        v
 pending_acceptance
   /          \
 Accept      Decline
   |            |
   v            v
 assigned    declined --> Admin notified --> Reassign
   |
   v
 picked_up --> in_transit --> delivered / failed
```

### Availability Logic (Pseudo-code)

```text
1. Fetch all bikers WHERE status = 'active'
2. Fetch all delivery_tasks WHERE status IN ('pending_acceptance','assigned','picked_up','in_transit')
3. busyBikerIds = tasks.map(t => t.biker_id).filter(Boolean)
4. availableBikers = activeBikers.filter(b => !busyBikerIds.includes(b.id))
5. Same logic for drivers using driver_id
```

### No Database Migration Required
- `delivery_tasks.status` is an unconstrained text column
- `internal_notifications` table already exists with the needed columns (`title`, `message`, `target_role`, `entity_type`, `entity_id`)

