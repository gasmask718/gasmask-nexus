# Feeno / Rufino — Approve the Existing Account (No New Person)

## What the audit found

Rufino is **one** person in the system, already signed up and already carrying his full territory and store list. There is **no second application and no duplicate record**. What happened is a leftover "waiting for approval" marker on his login that was never cleared when he finished signup — so the app keeps showing him the "awaiting approval" screen even though he is an approved ambassador.

Confirmed current state:

- Ambassador record: Rufino Vinales, RUFINOVINALES@gmail.com, 646-528-7484, active, not a test record, created Sep 11.
- Login: created and email-confirmed Sep 15, same address, linked to that exact ambassador record.
- Invite: the original one, accepted Sep 15 — reused, never duplicated.
- Areas: Bronx (primary), Mount Vernon, Yonkers, New Rochelle, Manhattan — all five present.
- Stores: 97 active assignments.
- Applications list: no application row at all for him, so nothing to approve there.
- His login carries two markers: "ambassador" **and** a stale "pending". Because the app just takes whichever marker comes back first, "pending" wins and he lands on the awaiting-approval screen. He also never got the profile row that newer signups get.

So: same person, already approved in substance, blocked by a stale marker — not an approval decision.

## What I will do

1. **Clear the block on Rufino's login only**
   - Remove the stale "pending" marker from his login.
   - Create the missing profile row for him with ambassador as his role, using his existing name and phone.
   - Touch nothing else on his record: same login, same email, same invite, same five areas, same 97 stores.

2. **Stop this from recurring**
   - Make the app ignore a "pending" marker whenever a real role is present, so a leftover marker can never send an approved person to the awaiting-approval screen again.

3. **Report, don't touch, the others**
   - Three other logins have the same stale-marker pattern. I will list them for Ching and change nothing, since they are outside this request.

4. **Verify**
   - Re-read his login markers, profile, areas and store count after the change and confirm 5 areas / 97 stores are unchanged, then confirm he routes to the ambassador home instead of the approval screen.

## Technical details

- Evidence read: `auth.users`, `user_roles`, `user_profiles`, `ambassadors`, `ambassador_invites`, `ambassador_applications`, `ambassador_assignments`, `ambassador_territory_coverage`, `public.accept_ambassador_invite`, `src/hooks/useUserRole.ts`, `src/config/osNavigation.ts` (`role === 'pending'` → `/pending-approval`), `src/pages/PendingApproval.tsx`.
- Identity: auth user `8d25323c-c592-4d5d-bd2d-3849eac68a55` ↔ ambassador `bec6d140-ec1b-4dc0-890c-6dc22f7a2f71`; invite `71e5cdd9-…` status accepted, `target_ambassador_id` matches. No conflict.
- Root cause: his Sep-15 acceptance ran before `accept_ambassador_invite` gained the `user_profiles` upsert; the function still never deletes the `pending` row in `user_roles`, and `useUserRole` falls back to `rolesList[0]` with no ordering.
- Data change: one targeted migration — delete `user_roles` row (that user, role `pending`), insert `user_profiles` row with `primary_role = 'ambassador'`. Scoped by user id; no bulk update.
- Code change: drop `pending` from consideration in the primary-role pick in `useUserRole.ts` when any non-pending role exists. No route deletions, no RLS changes, no invite reissue, no outreach.

## Out of scope

Fixing the other three stale-marker logins, changing the invite function's role cleanup for future signups, and any change to other ambassadors or applications.
