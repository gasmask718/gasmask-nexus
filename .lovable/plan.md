# Static QA Audit Report — Parts 4–7

Read-only scan. No files modified. One real bug flagged (Part 7).

## Part 4 — Integration QA

**REAnalyzer.tsx "Match to Buyers" type safety — PASS (with caveat).**
- The embed query `re_buyers … re_buyer_criteria(...)` is valid; `re_buyer_criteria_buyer_id_fkey` exists in `types.ts` so PostgREST resolves the relation.
- All buyer/criteria access is explicitly cast `(b: any)` / `(c: any)`, so there are no TS complaints — but that's *type erasure by escape hatch*, not real type safety. Fields like `crit.states`, `min_beds`, etc. are untyped. Acceptable for MVP, worth tightening later.

**SFLeadPipeline.tsx CSV dedupe null/undefined handling — PASS.**
- `norm(v)` and `normPhone(v)` both coerce `null`/`undefined` via `String(v ?? '')` → safe.
- `dedupKey` produces a stable `"fn|ln|"` when phone is missing, so no-phone rows still dedupe by name.
- `firstNames` list is filtered with `.filter(Boolean)`, avoiding a `.in('first_name', [''])` blowup.
- Minor gap (not a fail): if a row has no `first_name` at all, `.in('first_name', firstNames)` won't find it in DB — it will be inserted even if a nameless dup exists. Rare; safe to defer.

## Part 5 — Security QA

**SFContracts.tsx — PASS.** Uses `@/integrations/supabase/client` (the authenticated singleton). No service-role client, no anon key override, no `.rpc` bypass. RLS on `surplus_funds_contracts` governs the read.

**sf_callback_tasks auth token propagation — PASS.** No edge function or client code references `sf_callback_tasks` yet (only the migration + generated types). When accessed via `supabase.from(...)` it'll ride the user's session automatically. Nothing is bypassing auth today.

## Part 6 — Mobile QA

**SFContracts.tsx responsive table — PASS.** Table is wrapped in `<div className="overflow-x-auto">` (line ~86). Renders cleanly at 375px.

**REAnalyzer.tsx "Match to Buyers" touch target — FAIL (minor).** Button is rendered with default size (no `size="lg"` / no `h-10+` class):
```tsx
<Button variant="outline" disabled={saving || matching} onClick={runMatch}>
```
shadcn default size is `h-9` (36px) — under the 44px HIG target. Neighboring Save/Deal Sheet buttons share the same issue. Trivial fix: add `size="lg"` (or `className="h-11"`) to the three action buttons on lines ~348–352.

## Part 7 — System Readiness / 400–403 Hunt

**TS compilation across /surplus-funds and /real-estate — PASS.** No missing imports, no unresolved symbols. All table names referenced (`surplus_funds_contracts`, `sf_callback_tasks`, `re_buyers`, `re_buyer_criteria`, `surplus_funds_leads`, `surplus_funds_cases`) exist in `types.ts`.

**Data-fetching hooks — 1 FAIL flagged.**

🚩 **`SFCommandCenter.tsx` line 45 — likely 400.**
```ts
supabase.from('surplus_funds_cases').select(
  'status, surplus_amount, amount_received, our_expected_fee, client_name, property_address, county, state, attorney_name, created_at'
)
```
Per `types.ts`, `surplus_funds_cases` has **no `client_name` column** (it stores claimant fields differently). PostgREST will return **400 Bad Request: column surplus_funds_cases.client_name does not exist**. This matches the reported Penthouse 400. It cascades into `topCases[i].client_name` rendering.

Recommended fix (Build Mode): drop `client_name` from the select, and adjust the render on line 172 (`c.property_address || c.client_name`) to use the actual claimant field (likely `claimant_name` — needs one-line schema confirmation before switching).

Other hooks scanned are clean:
- `SFCases.tsx` uses `select('*')` — safe.
- `SFContracts.tsx` selects only real columns — safe.
- `SFAnalytics.tsx` selects only real columns — safe.
- `sf-callback-count` head-count query — safe.

## Summary

| # | Item | Status |
|---|------|--------|
| 4.1 | REAnalyzer match type-safety | PASS (any-casts) |
| 4.2 | SFLeadPipeline dedupe null-safety | PASS |
| 5.1 | SFContracts RLS/client | PASS |
| 5.2 | sf_callback_tasks auth | PASS |
| 6.1 | SFContracts responsive table | PASS |
| 6.2 | REAnalyzer touch targets | **FAIL** (h-9 buttons) |
| 7.1 | TS compilation clean | PASS |
| 7.2 | 400/403 root cause | **FAIL** — `client_name` on `surplus_funds_cases` in SFCommandCenter |

## Proposed Build-Mode fixes (on approval)
1. `SFCommandCenter.tsx`: remove `client_name` from the select; swap the fallback in Top Cases render to the real claimant column (verify `claimant_name` in schema first).
2. `REAnalyzer.tsx`: add `size="lg"` to the three action buttons (Save / Match / Deal Sheet) to hit 44px.
