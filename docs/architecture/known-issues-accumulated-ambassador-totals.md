# TICKET: `ut_pub_ambassadors` accumulates totals instead of deriving them

Status: **OPEN — not scheduled**
Raised: 2026-08-15
Function: `supabase/functions/ut-track-ambassador-sale/index.ts`
Columns: `ut_pub_ambassadors.total_sales`, `.total_earned`, `.tier`
Class: derived-vs-accumulated, not error handling

## The shape

Each sale does a read-modify-write of a running total:

```ts
const newTotalSales  = (ambassador.total_sales  || 0) + 1;
const newTotalEarned = (ambassador.total_earned || 0) + commissionAmount;
// ... tier derived from newTotalSales
update ut_pub_ambassadors set total_sales, total_earned, tier
```

Two failure modes, neither fixable by better error handling:

1. **Racy.** Two concurrent sales both read the old value and both write
   old + 1. One sale vanishes from the totals while both referral rows exist.
2. **Unrecomputable.** An accumulator cannot be rebuilt after an upstream
   delete. Remove a `ut_pub_referrals` row and the totals keep the money in
   them, with no way to know by how much they are wrong.

The tristan row proved the second one: when the sale was removed the totals
went to zero by luck, not by design. That is the third time this pattern has
cost us. Derived beats accumulated.

## What was done in the errText pass (2026-08-15)

The referral insert and the totals update both now destructure `{ error }` and
fail the request, and the totals update carries a comment pointing here. That
makes a failed write visible. It does not make the number correct — the drift
above happens on entirely successful writes.

## The fix

Stop storing the totals. `ut_pub_referrals` is the source of truth; every
number on the ambassador is a `sum()`/`count()` over it.

1. Create `ut_pub_ambassador_totals` as a SQL view over `ut_pub_referrals`
   (`count(*) as total_sales`, `sum(commission_amount) as total_earned`, tier
   derived from the count via the same thresholds the function uses).
2. Point every reader — the ambassador portal, the tier badge, the SMS body in
   this function — at the view.
3. Drop `total_sales` / `total_earned` / `tier` from `ut_pub_ambassadors` once
   no reader remains, and delete the read-modify-write block here.

Tier thresholds must live in exactly one place after this. They are currently
duplicated between `TIER_THRESHOLDS` in the function and the inline
`>= 50 / >= 25 / >= 10` ladder ten lines below it.

## Before the cutover

Reconcile once: compare each stored total against the derived value and record
the diffs. The size of that diff set is the real measure of how long this has
been wrong.
