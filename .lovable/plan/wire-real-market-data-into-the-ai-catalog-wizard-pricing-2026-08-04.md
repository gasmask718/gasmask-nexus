# Wire real market data into the AI Catalog Wizard pricing

## Current behavior (verified live)

- The wizard's `copy_pricing` step uses only the margin formula + AI copywriting. It reads the effective margin (currently 15%), computes a retail floor of `cost / (1 - margin)`, and clamps the AI's suggested prices to it. No competitor data is consulted.
- The wizard's "Check market" panel calls a separate step that reads a `SERPAPI_KEY` environment secret, which is not set — a live call returned `available: false, reason: "SerpAPI key not configured"`. The panel shows "SerpAPI dormant".
- The working competitor tooling (Check Market Price / Apply Sweet Spot on the Pricing page) uses a *different* key source: `dd_ai_config.serpapi_key`, which **is** populated. A live call there reached SerpAPI and returned a quota error (HTTP 429), confirming the key is real and wired.

So there are two problems: the wizard reads the wrong key location, and even when it works the market result is display-only.

## What will change

### 1. One key source
The wizard's market lookup will read the SerpAPI key from the same place the Pricing page does (`dd_ai_config`), falling back to the environment secret if present. Result: the "Check market" panel in the wizard goes live immediately, no new secret needed.

### 2. Market data feeds the suggested price
`copy_pricing` will, before generating prices:
- Run a market lookup for the product name + brand (reusing the same relevance filtering, bundle exclusion, and outlier trimming the Pricing page already uses, so bundles and junk listings don't skew the number).
- Pass the resulting low / median / high into the pricing prompt as market context.
- After the AI responds, apply the hard rules in this order:
  1. **Margin floor always wins.** Retail can never fall below `cost / (1 - margin)`.
  2. If the market median is above the floor, retail is steered toward the median (never below the floor, never above the market high without a stated reason).
  3. If the market median is *below* the floor, the floor is kept and the response flags "market is below our margin floor" so the wholesaler sees the conflict instead of a silent override.
- The rationale string will state which path was taken and the sample size, so the wizard shows *why* a price was suggested.

### 3. Graceful degradation
If the key is missing, the quota is exhausted (the 429 we just saw), or no relevant listings match, `copy_pricing` behaves exactly as today — formula + AI — and the response carries a `market: { available: false, reason }` field. The wizard shows a small "priced from formula only" note rather than failing the step.

### 4. Wizard UI
- The market panel moves above the price fields and shows the range that was actually used for the suggestion, plus the sample count.
- A "Re-price with market" button re-runs `copy_pricing` after the wholesaler edits cost or product name.
- Badge on the price block: "market-informed" vs "formula only".

## Technical notes

- `supabase/functions/dd-catalog-pipeline/index.ts`: extract the market lookup into a shared helper (`supabase/functions/_shared/`) alongside the filtering/trimming logic currently living in `dd-price-intelligence/index.ts`, so both call sites use identical math. `runCopyPricing` and `runMarketCheck` both consume it.
- Key resolution order: `dd_ai_config.serpapi_key` → `Deno.env.get('SERPAPI_KEY')` → unavailable.
- No schema change is required for the pricing logic itself. The market snapshot used for the suggestion is written into the existing `dd_catalog_drafts.market_check` column so the decision is auditable at publish time.
- The publish path's margin guard (23% floor enforcement in `dd-catalog-pipeline` publish) is untouched — this only affects what gets *suggested*.
- Frontend: `src/pages/dynasty-direct/DynastyDirectCatalogOnboard.tsx` only (panel placement, badge, re-price button). The wholesaler self-serve wrapper inherits it automatically.

## Note on quota

The live check returned SerpAPI HTTP 429 — the account's request quota is currently exhausted. The wiring will be correct, but market-informed pricing will keep falling back to formula-only until that quota resets or the plan is topped up.
