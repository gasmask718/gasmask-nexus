# OSM metro-2 measurement + category filter (2026-08-20)

Read-only. Nothing written to any lead or store table.

## Metro selection — the pick failed on its own terms

"Most `store_master` rows" outside NYC returns nothing usable. Live rows by state:
NY 1,677 · blank 267 · "Queens" (dirty state value) 15 · **NJ 8** · AZ 1.
Largest non-NYC city is Yonkers at 12 rows, then New Rochelle at 8, Newark at 2.

There is no non-NYC metro where an overlap number would mean anything. So the
measurement splits in two:

- **Overlap** measured on the largest non-Brooklyn set we actually have: **Queens, 255 live rows**.
- **Phone coverage** — the number that is actually the decision — measured standalone on
  three real non-NYC candidates. Coverage needs no overlap.

## Queens — same three counts, plus the unmeasurable line

| | count |
|---|---|
| OSM features (same 9 `shop=` categories) | 1,672 |
| store_master rows compared | 255 |
| **Already in store_master** | **26** (7 by phone, 19 by address+zip) |
| **New and measurable** | **913** |
| **Unmeasurable** (no phone, no address+zip — cannot be tested against us) | **733** |
| **Ours, absent from OSM** | **230** of 255 |
| New with a phone (callable ceiling) | 491 |
| Free phone enrichment on stores we know | **2** |

Brooklyn's 4% overlap was not a Brooklyn artefact. Queens is **1.6%**, and 230 of our
255 Queens stores are absent from OSM entirely. Two independent city-sized samples say
the same thing: these are disjoint sets. OSM is not a fuller version of our list and our
list is not a subset of it.

## Phone coverage — the whole decision

| Metro | OSM features | named | **phone** | full address | all three |
|---|---|---|---|---|---|
| Brooklyn | 2,172 | 96% | **41%** | 52% | 560 |
| Queens | 1,672 | 91% | **29%** | 45% | 327 |
| Philadelphia | 693 | 93% | **38%** | 53% | 243 |
| Buffalo NY | 167 | 97% | **47%** | 82% | 76 |
| Newark NJ | 135 | 94% | **19%** | 63% | 24 |

Coverage percentage is not the problem outside NYC — **density is**. Newark, a city of
300,000, has 135 mapped stores of this class against Brooklyn's 2,172. Buffalo has 167
and the best field completeness in the set (47% phone, 82% address), which yields
roughly **80 callable records for an entire metro** before any dedupe or chain filter.
Philadelphia is the only non-NYC metro here with real volume: 693 features, 265 with a
phone.

Under my own stated threshold — under ~20% phone coverage means it is a Google job with
an OSM seed — Newark fails outright and Queens is close to it. But the threshold was the
wrong test. A metro can hit 47% coverage and still be worthless when the denominator is
167.

**Revised read:** OSM is a **supplement everywhere, including Brooklyn.** It is worth a
one-time pull per metro because a pull costs nothing but bandwidth, and in Brooklyn it
produces 577 filtered callable records that we do not have. It is not a pipeline, it
cannot be run as one, and outside the five boroughs plus Philadelphia it will not
return enough per metro to justify the enrichment spend on the unmeasurable tail. The
687 Brooklyn and 733 Queens unmeasurables are the enrichment bill, and paying it to
convert name-only POIs is the part I would not fund.

## Reporting rule, carried

**Unmeasurable is its own line, never inside "new".** A feature with no phone and no
full address could not have matched anything by construction. Calling it new asserts a
comparison that was never run. Brooklyn: 90 matched / 1,395 new-and-measurable / **687
unmeasurable**. Queens: 26 / 913 / **733**.

## Category filter for the callable set

Your instinct is right on both counts and does most of the work. Applied to Brooklyn's
858 callable-new, in order:

1. **Drop `shop=supermarket`** — removes 228. Key Food (27), C-Town (10), Foodtown (8),
   Ideal Food Basket (12), Food Bazaar, NetCost, Associated. This is the single biggest cut.
2. **Drop anything carrying `brand`, `brand:wikidata`, or `operator`** — removes a further 49.
   Catches 7-Eleven, CVS, Walgreens, Dollar Tree, Five Below, and the petrol-forecourt shops.
3. **Drop by chain name regex** — removes 4 more that slipped both tags. Needed because OSM
   brand tagging is inconsistent; the same chain is tagged on one node and bare on the next.
4. **Drop any name appearing 3+ times in the metro** — caught 0 additional here after the
   first three, but it is the rule that catches the next chain we have never heard of
   without anyone maintaining a list.

**858 → 577 callable, chain-free.** Remaining mix is `convenience` 468, `deli` 76,
`variety_store` 64, `tobacco` 17 — which is the Grabba shape.

One caution on step 1: `shop=grocery` (10) and `variety_store` (64) are inconsistently
used by mappers for exactly the independent bodegas we want, so those stay in and get
eyeballed rather than cut. And 577 is still a ceiling — it has had no phone validation
and no line-type check, and mobile-only is the known problem on this store class.

## Not exported

Document storage is temporarily unavailable, so the filtered 577 was not written to a
file. It is reproducible from the pull; say the word once storage is back and I will
export it.
