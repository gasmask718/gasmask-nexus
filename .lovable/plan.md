

# SBO AI Engine — Stabilization and Unification Plan

## Current State Assessment

Your system already has **most of the components built**. The issue is not missing code — it's that the pieces are disconnected, some engines have bugs, and there's no unified dashboard or email report tying everything together.

**What exists and works (partially):**
- `sbo-daily-automation` — 7-step orchestrator (games → props → predictions → SMS → settle → bankroll → recalibrate)
- `sbo-run-analysis` — Props analysis engine (reads `sbo_player_props`, generates predictions)
- `sbo-analyze-tonight` — Game-level predictions from `sbo_games`
- `sbo-sync-polymarket` / `sbo-sync-polymarket-full` — Polymarket market sync
- `sbo-consensus-engine` — Capper performance + consensus scoring
- `sbo-compare-odds` — Polymarket vs sportsbook divergence detection
- `sbo-generate-daily-briefing` — Briefing builder (moneyline + props + parlays)
- `sbo-match-capper-picks` / `sbo-parse-capper-image` — Capper pick ingestion
- `SBOWalletTracker.tsx` — Polymarket wallet tracker UI

**What's broken or missing:**
1. No **email delivery** — only SMS via Twilio
2. No **unified Top Bets / Consensus dashboard** combining all 3 engines
3. Polymarket wallet tracker lacks automated scraping
4. Telegram capper scraping not connected to consensus
5. Daily automation doesn't call consensus engine or Polymarket sync
6. No single "AI Engine Results" dashboard with 3-panel view

---

## Implementation Plan

### Phase 1: Fix Daily Automation Pipeline (Edge Function)
**File:** `supabase/functions/sbo-daily-automation/index.ts`

Add missing steps to the 7-step orchestrator:
- **Step 1.7**: Call `sbo-sync-polymarket` to sync Polymarket markets
- **Step 2.5**: Call `sbo-run-analysis` (the detailed props analysis) after predictions
- **Step 3.5**: Call `sbo-consensus-engine` to build consensus scores
- **Step 3.7**: Call `sbo-compare-odds` for Polymarket vs books divergence
- Ensure each step has retry logic (1 retry on failure) and proper error logging

### Phase 2: Build Consensus Top Bets Engine (New Edge Function)
**File:** `supabase/functions/sbo-top-plays/index.ts` (exists, will be rewritten)

This engine will:
- Query `props_master` for props with `consensus_score >= 65`
- Query `sbo_odds_comparison` for Polymarket value spots (`has_value = true`)
- Query `sbo_capper_picks` for today's verified picks
- Cross-reference all 3 sources to find overlapping picks
- Score each pick: `(consensus_score * 0.4) + (ai_confidence * 0.3) + (polymarket_edge * 0.3)`
- Save results to a new `sbo_top_plays` table with columns: pick, sport, engines_agreed, confidence, edge_score, signal_sources

**Database migration:** Create `sbo_top_plays` table.

### Phase 3: Build Daily Email Report (New Edge Function)
**File:** `supabase/functions/sbo-send-daily-email/index.ts`

- Use Lovable Cloud's built-in email or Resend integration
- Sections: Top Consensus Picks, Props Engine Picks, Polymarket Signals, Capper Signals
- Each pick shows: Game, Pick, Odds, Confidence, Source Engines
- Called at the end of `sbo-daily-automation` after all analysis is complete
- Recipients managed via `sbo_sms_recipients` table (add `email` column)

### Phase 4: Build Unified AI Engine Dashboard (UI)
**File:** `src/pages/os/betting/SBOCommandCenter.tsx` (new)

Three-panel layout:
1. **Props Engine Panel** — Today's prop predictions from `sbo_predictions` with confidence tiers
2. **Polymarket Signals Panel** — Value spots from `sbo_odds_comparison` where `has_value = true`
3. **Capper Signals Panel** — Today's verified capper picks from `sbo_capper_picks`

**Top Bets Section** at the top:
- Pulls from `sbo_top_plays` table
- Shows: Game, Pick, Odds, Engines in Agreement, Confidence Score
- Color-coded: ELITE (gold), STRONG (green), WATCHLIST (blue)

### Phase 5: Fix Polymarket Wallet Tracker
**File:** `supabase/functions/sbo-sync-polymarket-full/index.ts`

- Add wallet tracking: monitor known wallet addresses for position changes
- Store trades in `sbo_polymarket_wallets` table (new migration)
- Feed high-conviction wallet signals into the consensus engine

### Phase 6: Wire Telegram Capper Data into Consensus
**File:** `supabase/functions/sbo-consensus-engine/index.ts`

- Already reads `sbo_capper_picks` — verify Telegram-sourced picks have `source = 'telegram'`
- Ensure `sbo-parse-capper-image` correctly tags source channel
- Add Telegram pick count to consensus scoring weight

### Phase 7: Add Route and Sidebar Entry
**File:** `src/modules/betting/index.ts`

- Add `SBOCommandCenter` as a new route: `/os/sports-betting/command-center`
- Add sidebar item with `Monitor` icon: "Command Center"
- Position it as the first item in the sidebar for quick access

---

## Technical Details

### New Database Tables

```sql
-- Top plays consensus table
CREATE TABLE sbo_top_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_date DATE NOT NULL,
  player_name TEXT,
  pick TEXT NOT NULL,
  sport TEXT DEFAULT 'NBA',
  odds_american INTEGER,
  confidence NUMERIC,
  edge_score NUMERIC,
  engines_agreed TEXT[] DEFAULT '{}',
  engine_count INTEGER DEFAULT 0,
  signal_sources JSONB DEFAULT '{}',
  recommended_action TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add email column to recipients
ALTER TABLE sbo_sms_recipients ADD COLUMN IF NOT EXISTS email TEXT;
```

### Files Changed (Summary)
1. `supabase/functions/sbo-daily-automation/index.ts` — Add Polymarket + consensus steps
2. `supabase/functions/sbo-top-plays/index.ts` — Rewrite as consensus detector
3. `supabase/functions/sbo-send-daily-email/index.ts` — New email report function
4. `supabase/functions/sbo-consensus-engine/index.ts` — Wire Telegram source
5. `src/pages/os/betting/SBOCommandCenter.tsx` — New unified dashboard
6. `src/modules/betting/index.ts` — Add route + sidebar
7. Database migration for `sbo_top_plays` table + email column

### Execution Order
1. Database migration first (tables needed by functions)
2. Edge functions (top-plays → email → automation updates)
3. UI (command center dashboard)
4. Sidebar wiring

