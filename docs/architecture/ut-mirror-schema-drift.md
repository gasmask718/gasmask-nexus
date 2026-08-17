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
