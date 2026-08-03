# Invoice Integrity, Unit Math, and the Silent-Write Wrapper

Three of the four items changed shape once the gating queries came back. Read the two STOP findings before approving — one blocks the brand work, one shrinks the data repair to almost nothing.

---

## STOP 1 — Brand repartition recovers nothing. Do not build it.

You asked for the orphan count before any build. Here it is:

| Orphan invoices (brand null/blank) | 1,407 |
|---|---|
| Have line items with usable brand | **1** |
| Have line items with no brand | 0 |
| **Have no line items at all** | **1,406** |

Repartitioning on `invoice_line_items.brand_id` recovers exactly one invoice. The orphans aren't mis-partitioned, they're empty.

The wider number is worse, and it reframes the whole item:

- 3,166 invoices exist
- **395** have any line items
- **2,771** are header-only shells
- 1,365 of those shells *do* have a brand string on the header

So `invoices.brand` isn't a landmine that's corrupting good data — for 2,771 invoices it is the *only* brand information that exists. Killing the write without a line-item backfill destroys the sole brand signal on 87% of invoice history.

Every one of the 395 real line items already has `brand_id` populated (395/395). The partition key you want is already clean and complete wherever line items exist.

**Recommendation: park the brand work.** The correct first question is not "how do we partition brand" but "why do 2,771 invoices have no line items" — that's likely a fifth silent write loss, and it is the same root cause family as the systemic audit below. I'd rather find that than build a v2 view over data that isn't there.

If you still want the view built for the 395, say so and I'll do it — but it changes nothing visible today, because of STOP 2.

### What reads the view (you asked before anything moves)

Smaller blast radius than expected. `v_store_last_order_snapshot` has **exactly one** code consumer:

```text
v_store_last_order_snapshot
  └── src/hooks/useLastOrderSnapshot.ts   (useLastOrderSnapshot, useLastOrderSnapshotBatch)
        ├── UnifiedTubeIntelligenceCard.tsx      (tube intel)
        ├── LastOrderKPIBadge.tsx                (KPI card)
        │     ├── src/pages/Stores.tsx           (store list, batch)
        │     └── portal/field/StoreListPage.tsx (field store list, batch)
        ├── LastOrderSnapshotPanel.tsx → pages/StoreDetail.tsx
        └── delivery/checklist/LastOrderContextSection.tsx
```

No reports, no exports, no edge functions. Six surfaces behind one hook.

---

## STOP 2 — The tube data is not wrong. It's mislabeled.

The hypothesis was that box sales stamped `unit_type='TUBE'` corrupted tube counts. Half right.

**125 of 396 TUBE rows are priced at box price, not tube price.** They are real box sales wearing a tube label. 76 stores, 125 invoices, $25,100.

But the tube math was never taken from `unit_type`. There is a second column, `sale_unit`, that carries the truth, and the computation used it:

| Row shape | Count | Tube math |
|---|---|---|
| `sale_unit='box'`, `unit_type='TUBE'` | 127 | correct on 126 |
| `sale_unit='unit'`, `unit_type='TUBE'` | 269 | correct on 269 |
| `sale_unit='box'`, `unit_type='BOX'` | 1 | correct |

A representative suspect row: quantity 1, unit_price $200 (= box price), `sale_unit='box'`, **`computed_tubes_total` = 100**. Correct. Summed across all 125 suspects: recorded 12,800 tubes vs. 12,800 if recomputed from `quantity × units_per_box`. Identical.

So tube counts, tube-price averages and tube intelligence are **not** wrong. `unit_type` is a vestigial column that no math reads. The corrective backfill is a label repair, not a value repair — and it is cosmetic unless a surface reads `unit_type` directly.

Two genuine defects did surface:

1. **One row** has box math wrong (`sale_unit='box'` but tubes ≠ quantity × units_per_box).
2. **7 rows** have `units_per_box_snapshot` drifting from the product's current `units_per_box` — including a GasMask Bags row snapshotted at 1 where the product says 100.

Proposed backfill (**not run, for approval**): set `unit_type = 'BOX'` where `sale_unit='box'`, leave all computed values untouched, and hand-correct the 1 bad-math row and the 7 drifted snapshots individually after inspecting each. No recomputation of `computed_tubes_total` anywhere — it is already right and touching it would be the actual risk.

Cohort note: you asked to report the 212 backfill rows separately. That split doesn't exist — **all 397 line items carry `pricing_mode` and snapshot fields**, so there is no live-vs-backfill distinction in the data. The earlier 184/212 figure was wrong. By month: Feb 169 rows (29 at box price), Mar 217 (94), May 1, Jun 2, Jul 8 (2).

---

## Unit decision — confirmed, with your preference adopted

`products.units_per_box` is the source of truth. `computed_tubes_total` is **numeric**, not integer — so 2.5 tubes would store silently rather than error, which makes the guardrail more important, not less.

**Adopting your preference: block half-box on odd `units_per_box`.** A half box of an odd count isn't a real thing being sold, and numeric storage means a rounding choice would hide the bad configuration instead of surfacing it. The half-box branch becomes `quantity * units_per_box_snapshot / 2`, guarded by a check that rejects odd box sizes with a message naming the product.

Live exposure is currently nil — no product has an odd `units_per_box` (values are 100 ×9 and 1 ×3). The 1s are misconfigured and the guardrail will surface them: box size 1 is odd, so half-box gets blocked on exactly the products that shouldn't offer it.

Note for later: `products.units_per_box` has a column default of **24**, which matches no actual product. Any new product created without an explicit box size inherits a wrong value. Worth fixing separately.

---

## Systemic audit — answered

Two failure modes, both widespread.

**Mode A — write rejected, zero rows, UI says success.** 2,515 update/delete calls across the codebase; **1,307** don't observe the result. Without `.select()` PostgREST returns 204 and the client genuinely cannot tell an RLS rejection from a legitimate no-op.

**Mode B — error caught and only logged.** **588 console-only catch blocks across 388 files.** These swallow real failures; `visit_logs` (0 rows ever written where `visit_type='order'`) is one of them.

Worst overlap: `UTVirtualTours.tsx` (25), `SportsBettingOS.tsx` (11), `floor9/executionEngine.ts` (10), `useAuditEngine.ts` (9), `VARosterPage.tsx` (9), `StoreCardQuickView.tsx` (9).

### The shared wrapper

`src/lib/verifiedMutation.ts` already exists and covers Mode A — it forces `.select('*', { count: 'exact' })` and throws `VerifiedMutationError` on zero rows. This plan extends it to Mode B and makes it the single entry point:

- `verifiedUpdate` / `verifiedInsert` / `verifiedDelete` — unchanged, throw on zero rows
- **new** `reportError(err, context)` — replaces bare `console.error` in catch blocks; logs *and* raises a toast with the parsed RLS/constraint reason via the existing `parseRLSError`
- **new** `withReporting(fn, context)` — wraps an async handler so any throw surfaces to the user instead of dying in the console
- An ESLint rule flagging `.update(`/`.delete(` without `.select(` and catch blocks whose only statement is `console.*`, so the count can't regress

Migration is by module with verification after each, not one mechanical sweep. `SellsFlowersToggle` is the reference implementation.

---

## Sequencing

1. **Systemic wrapper** — extend `verifiedMutation.ts` with `reportError` / `withReporting`, add the lint rule. Outranks feature work, as you said.
2. **Investigate the 2,771 header-only invoices** — likely failure mode A or B, and it's the real blocker behind the brand question.
3. **Unit guardrail** — half-box formula plus odd-box-size block.
4. **Historical label repair** — propose exact row lists for the 125 relabels, 1 math fix, 7 snapshot fixes; run only on approval.
5. **Brand header** — deferred pending item 2. Stop writing `brandSummary` at that point, not before.
6. **`/flower-customers`** — unblocked, since the brand decision no longer gates it.

## Technical detail

- No migration in steps 1–3. Step 4 is data-only via the insert tool, after row-level approval.
- `invoices.brand` stays a column regardless; the only question is what gets written to it.
- Guardrail lives in the shared `InvoiceBuilder` so all four write paths inherit it.
