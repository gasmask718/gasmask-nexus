# TICKET: ~1,038 unread database writes (Group A backlog)

Status: **OPEN — logged, not scheduled**
Raised: 2026-08-15
Scope: whole codebase (edge functions + browser)

## What this is

A write of the form

```ts
await supabase.from("some_table").insert({ ... });
```

never throws on failure. The Supabase client returns `{ data, error }`. When the
result is not destructured, an RLS denial, a constraint violation, or a column
mismatch produces exactly the same observable behaviour as success: nothing.

A codebase sweep for `await supabase.from(...).(insert|update|upsert|delete)`
with no `{ error }` destructure and no `.throwOnError()` found approximately
**1,038 such sites**, of which 85 are inside the Unforgettable Times surface.

## What has been done

- 6 money-path functions were reviewed individually — see
  `docs/architecture/errtext-money-path-review.md`. Fixes to those are decided
  per function, not in bulk.
- Group B (logging) and Group C (user-facing copy) were fixed wholesale with
  `errText` — those change no control flow.

## What has NOT been done

The remaining ~1,038 unread writes are untouched. This is deliberate.

Each one is a **behaviour decision, not a logging change**: does a failed write
fail the request? A failed `experience_alerts` insert should not 500 a booking.
A failed `ut_bookings` insert should not return HTTP 200. There is no rule that
covers both, so a bulk pass would mean making that judgement ~1,038 times
without reading any of them.

## Why this file exists

So the next person to run that grep knows the number is known, the silence is
understood, and the fix is a per-site judgement call rather than a sweep. This
is not a newly discovered problem.

## If picking this up

Work it in slices, by blast radius, not by file count:

1. Writes on a paid path (money moved, then the record failed) — highest.
2. Writes that gate a later read (a missing row makes a UI lie).
3. Audit / alert / telemetry writes — log the error, never fail the request.
4. Analytics pings and view counters — leave unread on purpose.

Reproduce the count:

```bash
rg -n --multiline 'await supabase\s*\n?\s*\.from\([^)]*\)\s*\n?\s*\.(insert|update|upsert|delete)\b' \
  src supabase/functions | rg -v '\{\s*(data|error)' | wc -l
```
