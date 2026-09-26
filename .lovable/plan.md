# Anna Batch 1 — Measurement Gate & Return-to-Supplier Path (Read-Only Findings)

Read-only inspection of the Catalog Review Queue and the publish pipeline. No code or data changed.

## 1. Can a product be published without human-confirmed weight + dimensions?

**No. It is strictly required, enforced in two independent places.**

- **UI gate** (`DynastyDirectCatalogReview.tsx`): the Publish button is disabled unless `measurements_verified_at` is set (`canPublish = supplier_id && verified`). Attempting otherwise shows "Confirm or enter measurements first".
- **Server gate** (`dd-catalog-pipeline`, `runPublish`): even if the UI were bypassed, the publish step throws `cannot publish: measurements not verified` when `measurements_verified_at` is null. The page header states the rule plainly: "Nothing publishes without a human-confirmed measurement."

**`measurements_verified_at` can only be set by a human, in exactly two ways:**
1. **"Confirm sourced measurements"** — one click, available only when the auto-sourcing step already found weight AND dimensions with status `sourced`. This copies the sourced values in and marks them human-verified. No typing needed, but a human must still click.
2. **Manual entry** — weight (oz) plus length, width, height (in), all greater than 0. The form rejects incomplete or zero values.

AI estimates and web-sourced specs never set the verified flag on their own — the pipeline code comments state this deliberately: "measurements_verified_at stays a human action" and "never publish on an unverified estimate (shipping bills on actuals)".

**Bottom line for Anna's batch:** each of the 25 items needs either a successful sourced-spec confirmation (one click) or manual weight + L×W×H before Publish → Live. There is no skip, bulk-approve, or override.

## 2. Can the measurement requirement be returned to Anna without rejecting the product?

**No in-system path exists.**

- The review patch function allows a status change to `rejected` only — "publishing goes through the pipeline". There is no `needs_measurement` / `returned` / `changes_requested` draft status.
- There is no notify-supplier or request-info action on the review page.
- Anna's supplier portal does not show submitted drafts back to her, so she cannot see or fix measurements on a pending draft.

**The only options today:**
1. **Reject with a reason** (e.g. "please resubmit with weight and dimensions") — the reason is stored on the draft, but Anna has no portal view of rejections, so you'd also need to tell her outside the system.
2. **Admin resolves it themselves** — run the measurement-sourcing/estimate step from the review card and confirm the result (one click if sourced), or enter measurements manually.
3. **Contact Anna outside the system** and have her resubmit a corrected spreadsheet as a new batch.

## Optional follow-up (not started)

If wanted, a future change could add a "Request measurements from supplier" action: a `changes_requested` draft status, a supplier-portal view of returned drafts with a weight/dimension entry form, and resubmission back into the queue. That would be a separate plan requiring your approval.
