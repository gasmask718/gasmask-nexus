# Dynasty Funding Hub — Lender Data & Auto-Fill Application

**Status:** Audit as of 2026-08-11. Read-only inspection of live schema, edge functions, and UI. No assumptions — every claim below was verified against the database or source files.

---

## 1. TL;DR

The Auto-Fill Application dropdown is empty because **`funding_lender_database` has 0 rows** and **the page that loads lenders into it is not routed in the app**. The plumbing is ~80% built; the lender registry has simply never been populated and its admin UI was never wired into navigation.

Lender data is **not** supposed to come from Grant OS. Grant OS stores *grant funders* (foundations/agencies), which is a different entity with a different schema. The correct single source of truth for lenders is `public.funding_lender_database` (+ `funding_lender_products` + `lender_automation_config`).

---

## 2. Where lender data actually lives today

| Table | Rows | Purpose | Used by Auto-Fill? |
|---|---|---|---|
| `funding_lender_database` | **0** | Intended master lender registry (37 cols: `lender_name`, `product_name`, `category`, `min_credit_score`, `min_revenue`, `min_time_in_business_months`, `application_url`, `prequal_url`, `submission_method`, `automation_allowed`, `docs_required`, `stack_priority`, `funding_lane`, …) | **Yes — this is the dropdown source** |
| `funding_lender_products` | 0 | Per-lender product variants (child of the registry) | No |
| `lender_automation_config` | 0 | Per-lender submission config: `submission_method`, `api_base_url`, `api_secret_name`, `adapter_key`, `automation_authorized`, `requires_otp`, `requires_signature`, `max_attempts` | **No — not read by auto-fill** |
| `auto_lenders` | **17** | Auto/vehicle financing lenders only (different vertical, own schema: LTV, vehicle age/mileage) | No |
| `lenders` | 0 | Legacy real-estate/hard-money lender list | No |
| `grant_funders` | **10** | Grant OS funders (foundations, agencies) — grants, not debt | Yes, but only in `funder_type='grant'` mode |
| `funding_client_lender_matches` | 0 | Output of `lender-matching-engine` | No |
| `funding_autofill_runs` | 0 | Audit log of every auto-fill package generated/submitted | Yes (writes) |

RLS on all of the above is staff/service-role scoped and permits reads for authenticated staff — **RLS is not the cause of the empty dropdown.**

---

## 3. How Auto-Fill currently works (verified flow)

**UI:** `src/components/funding-machine/AutoFillApplicationDialog.tsx`

1. On open, if no funder was preselected, it queries:
   - `funder_type='lender'` → `funding_lender_database` (`id, lender_name`), limit 200
   - `funder_type='grant'` → `grant_funders` (`id, name`)
2. User picks a funder → invokes edge function `auto-fill-application`.

**Edge function:** `supabase/functions/auto-fill-application/index.ts`

3. Loads `funding_clients` (or `grant_business_profiles`), then `funding_application_profile` for that client — auto-seeding the profile from the client record if it doesn't exist.
4. Loads the funder row from `funding_lender_database` **or** `grant_funders`.
5. Calls Lovable AI (`google/gemini-2.5-flash`) to draft `cover_letter`, `business_narrative`, `use_of_funds_plan`.
6. Computes `missing_fields` against a hardcoded required list (legal name, EIN, address, owner name/email, annual revenue, requested amount).
7. Returns a normalized `filled_package` JSON (business / owner / banking / request / narratives) and logs it to `funding_autofill_runs`.

### What it does NOT do (confirmed gaps)

- It does **not** read `application_url`, `submission_method`, `docs_required`, or any lender-specific field mapping. The lender row is passed to the AI as context only.
- "Approve & Submit" sets `status='submitted'` and `submission_method='api'` in the log — **no actual submission is performed.** Nothing is POSTed anywhere and no portal is opened.
- It never consults `lender_automation_config`, so per-lender adapters, OTP/signature requirements, and automation authorization are ignored.
- The package shape is one-size-fits-all; there is no per-lender required-field schema.

**Separate, unrelated function:** `submit-lender-application` operates off `funding_client_lender_matches` and only creates a prequal reminder + surfaces `prequal_url`. It is not called by the Auto-Fill dialog.

---

## 4. Why the dropdown is empty

Two independent causes, both real:

1. **No data.** `select count(*) from funding_lender_database` → `0`.
2. **No way to add data through the app.** `src/pages/funding-machine/LenderImportPage.tsx` exists and is fully implemented (spreadsheet upload → column mapping → upsert into `funding_lender_database`, batch-tracked in `funding_lender_import_batches`), but a route search across `src/` found **no route registration and no sidebar entry** for it. It is an orphaned page.

So: the connection is *implemented but unreachable*, and the registry is *empty*.

---

## 5. Should lender data come from Grant OS?

**No.** They are different domains and the schemas are not compatible:

- `grant_funders` models philanthropic/agency funders: `focus_areas`, `grant_size_min/max`, `application_deadline_typical`, `accepts_unsolicited`, relationship-management fields. There is no credit score, revenue minimum, time-in-business, APR, submission method, or automation config.
- `funding_lender_database` models debt products: underwriting boxes, stacking priority, inquiry sensitivity, soft-pull prequal, docs required, submission method.

Syncing one into the other would corrupt both. The correct model is **two registries, one shared client identity** — which already exists via `grant_business_profiles.funding_client_id` and the `get_capital_plan(client_id)` RPC. Auto-Fill already switches registries on `funder_type`, which is the right design.

**Recommendation:** keep `funding_lender_database` as the single source of truth for lenders, keep `grant_funders` as the single source of truth for grants, and keep the funder-type switch. Do not build a Grant OS → Funding Hub lender sync.

`auto_lenders` (17 rows) is a third, genuinely separate vertical (vehicle financing) and should stay separate — or, if those lenders are also usable for business funding, be imported into the registry deliberately rather than joined at runtime.

---

## 6. What needs to be built

Ordered by dependency. Nothing here is speculative — each item closes a gap verified above.

### Phase A — Make the registry reachable and populated (unblocks the UI today)
1. Register a route for `LenderImportPage` (e.g. `/os/funding/lenders/import`) and add a **Lenders** entry under the Funding Hub section in `src/components/Layout.tsx` (the source of truth for the sidebar).
2. Build a **Lender Registry** list/detail page over `funding_lender_database`: search, filter by `category`/`funding_lane`, activate/deactivate, and manual create/edit for one-off lenders.
3. Seed the registry — import the real lender list via the existing spreadsheet importer.

### Phase B — Make the dropdown lender-aware
4. Filter the dialog query to `is_active = true` and order by `lender_name`; show `product_name`, `category`, and min credit score in the option label so operators pick the right product.
5. Show an explicit empty state ("No lenders in the registry — import lenders first", with a link) instead of a silently blank select.

### Phase C — Make the package lender-specific
6. Add a per-lender field schema (`required_fields jsonb` on `funding_lender_database`, or reuse `docs_required`) and have `auto-fill-application` compute `missing_fields` from **that lender's** requirements instead of the hardcoded list.
7. Pass the lender's underwriting box (min score/revenue/TIB) into the response so the UI can warn when the client falls outside it before submission.

### Phase D — Make submission real
8. Join `lender_automation_config` in `auto-fill-application` and branch on `submission_method`:
   - `manual` → return `application_url`, mark the run `awaiting_manual`, open the portal in a new tab.
   - `api` → call the adapter using `api_base_url` + `api_secret_name`; store the response on the run.
   - `browser` → hand off to the existing `automation_jobs` Playwright worker.
9. Stop writing `status='submitted'` unless a submission genuinely occurred; add `awaiting_manual` / `failed` states and persist the provider response.
10. Honor `automation_authorized`, `requires_otp`, `requires_signature`, `requires_human_verification` as hard gates — consistent with the AI-non-autonomous rule.

---

## 7. Answers to the specific questions

| Question | Answer |
|---|---|
| Where are lenders stored/managed? | `public.funding_lender_database` (currently empty). Management UI exists (`LenderImportPage`) but is not routed. |
| How does Auto-Fill know which lender/portal to use? | It currently **doesn't**. It reads the lender row for AI context only and ignores `application_url` / `submission_method`. |
| Should Funding Hub have its own lender DB? | Yes — it already has the schema for one. |
| Should it pull from Grant OS? | No. Grant OS holds grant funders, a different entity with an incompatible schema. |
| How should the two connect? | Only at the **client identity** layer, which already exists (`grant_business_profiles.funding_client_id`, `get_capital_plan`). Funder registries stay separate and are selected by `funder_type`. |
| Already implemented, just missing from the UI? | **Partly.** Registry + importer + dropdown wiring exist (missing route + data). Lender-specific field mapping and real submission are **not** built. |
