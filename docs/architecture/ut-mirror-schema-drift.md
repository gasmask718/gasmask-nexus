# UT mirrors — schema drift and the silent discard rule

Applies to `receive-ut-staff`, `receive-ut-venue`, `receive-ut-rental`,
`receive-ut-ambassador`.

## The rule

**Dropping an unrecognised field is a decision, and a decision made by omission
is one nobody made. An allowlist that discards silently is the same shape as a
catch block that swallows.**

The 500 we started with (`custom_role_description` missing on
`staff_members_ut`) was loud: found in a day, cost one delayed row. The venue
path had been quietly dropping `latitude`/`longitude` for its whole existence —
the column existed, UT sent the data, and all six rows were NULL. Nothing
anywhere said so, and nobody would ever have looked. The silent discard was the
worse failure.

## The shape every mirror must have

1. An explicit allowlist / field map — payload key to column.
2. Everything not in it goes into a `mirror_extra` jsonb column on the target
   table. Never dropped.
3. Unknown keys are logged by name: `schema drift: N unknown field(s) captured
   into mirror_extra: a, b, c`.
4. Unknown keys are echoed in the 200 as `unknown_fields`, so the sender learns
   what we didn't understand without reading our logs.
5. Unknown fields are never a reason to reject a signup. The mirror keeps
   flowing; `mirror_extra` is the backlog of columns to promote.
6. Promotion out of `mirror_extra` gets a real typed column, nullable, **no
   default**. Coordinates in particular stay NULL when unresolved — a
   fabricated `0,0` puts every unresolved vendor in the Gulf of Guinea.

A non-empty `mirror_extra` is a schema gap to close, not a normal state.

## Current state (2026-08-17)

| mirror | table | mirror_extra | echo | geo wired |
|---|---|---|---|---|
| staff | `staff_members_ut` | yes | yes | `latitude`/`longitude` promoted |
| venue | `event_halls` | yes | yes | `latitude`/`longitude` now written |
| rental | `rental_partners` | yes | yes | `latitude`/`longitude` → `geo_lat`/`geo_lng` |
| ambassador | `unforgettable_ambassadors` | yes | yes | none sent; would land in `mirror_extra` |

Fields promoted in this pass because they were arriving and being discarded:

- `event_halls.latitude`, `event_halls.longitude` — column already existed, was
  never in the venue insert's field list. 6/6 rows NULL.
- `unforgettable_ambassadors.city` — the function destructured `city` and
  passed it to the insert, but the column did not exist, so PostgREST dropped
  it. 5/5 rows have no city. Column added.

## What we still cannot see

Nothing on this side stores the raw inbound payload, so the definitive list of
what UT sends today can only come from (a) UT's outbox rows, or (b) the
`unknown_fields` echo on the next delivery through each path. Everything above
was derived from column-versus-insert comparison and from rows that are NULL
where they should not be. The echo is now on all four; from the next delivery
onward the list is observed rather than inferred.

## Identity and replay (2026-08-17, second pass)

UT injects `ut_listing_id` + `ut_entity_type` at its single enqueue point.
Every mirror table has a nullable `ut_listing_id text` with a **plain** unique
index, and all four functions `upsert(..., { onConflict: 'ut_listing_id' })`
when the id is present.

The index must NOT be partial. A partial unique index
(`WHERE ut_listing_id IS NOT NULL`) is only inferable when the statement
repeats the predicate, which PostgREST's `onConflict` cannot express — every
delivery 500s with *"no unique or exclusion constraint matching the ON CONFLICT
specification"*, and the migration and typecheck both pass silently beforehand.
A plain unique index is equivalent here: Postgres treats NULLs as distinct, so
id-less legacy rows are still unconstrained. Any new mirror table gets a plain
unique index plus one throwaway double-upsert executed against it before ship —
this class of failure only appears at execution time.


| table | UT source |
|---|---|
| `event_halls` | `event_halls.id` |
| `rental_partners` | `rental_companies.id` |
| `staff_members_ut` | `staff_members.id` |
| `unforgettable_ambassadors` | `ambassadors.id` |

### The email 409 — scoped, not removed

It fires **only when `ut_listing_id` is absent**. With an id present the
upsert is the guard; leaving the 409 on that path would reject a replay
before the write and give back no `unknown_fields` echo, which is the whole
point of replaying. Only one path is live per request — there is no branch
where both run.

### A mirror with no `ut_listing_id`

- id absent, email present → legacy path: email 409 guard, then insert.
- id absent, email absent → **400 `UNIDENTIFIABLE`**, never inserted. With
  neither key we cannot tell a replay from a new partner, and a blind insert
  is the silent duplicate this whole pass exists to prevent.

### First-sight-only fields

A replay must not undo human decisions. `status` (all four), `verified`
(rental) and `referral_code` (ambassador) are written only when no row with
that `ut_listing_id` exists yet. An approved partner stays approved across
any number of redeliveries, and an ambassador keeps the referral code they
have already been sharing.

The 200 now carries `mode`: `inserted`, `updated`, or `inserted_legacy`.
