

## Plan: Fix Build Error + Sports Betting AI OS Audit Report

### Part 1: Build Error Fix (TS2589 in AICampaignTab.tsx)

**Problem**: Line 83 — Supabase's type inference on `.from("profiles").select(...)` creates excessively deep type instantiation.

**Fix**: Break the type inference chain by typing the query result explicitly. Replace the Supabase query builder chain with a raw approach using `.from("profiles").select("id, first_name, last_name, phone, role")` cast to break recursion, or use the `supabase.from("profiles" as any)` escape hatch that the rest of the codebase uses.

**File**: `src/pages/communication/messaging/AICampaignTab.tsx` — line 83-87, change to:
```typescript
const { data, error } = await (supabase
  .from("profiles") as any)
  .select("id, first_name, last_name, phone, role")
  .eq("business_id", currentBusiness.id)
  .in("role", selectedRoles);
```
Apply same pattern to the second query (Path 2) if it has the same issue.

---

### Part 2: Sports Betting AI OS — Full Audit Report

#### SECTION 1: DATABASE TABLES

| Table | Rows | Purpose | Status |
|-------|------|---------|--------|
| `bankrolls` | 0 | Global/state bankroll tracking | EMPTY — never used |
| `bets_executed` | 0 | Real bet log | EMPTY — never used |
| `bets_simulated` | 34 | AI simulation bets | Has data, connected to dashboard |
| `pick_entries` | 15 | Multi-leg entry tracking | Has data, connected to UI |
| `platforms` | 7 | Sportsbook/fantasy platform registry | Seeded (DK, FD, BetMGM, etc.) |
| `state_rules` | 3 | State compliance rules (NY/GA/CA) | Seeded, connected to UI |
| `sportsbook_lines` | 1 | Uploaded lines from books | Nearly empty |
| `market_lines` | 4 | Line intake data | Minimal data |
| `parlays` | 0 | Parlay tracking | EMPTY |
| `prop_results` | 0 | Settled prop outcomes | EMPTY |
| `confirmed_game_winners` | 16 | Game winner confirmations | Has data |
| `nba_games_today` | 33 | Daily NBA schedule | Has data from SportsDataIO |
| `nba_moneyline_predictions` | 21 | AI moneyline predictions | Has data |
| `nba_props_generated` | 1,407 | AI-generated player props | Has data — main AI output |
| `ai_game_predictions` | 17 | AI game-level predictions | Has data |
| `ai_confidence_corrections` | 0 | Model correction log | EMPTY |
| `ai_confidence_recalibrations` | 0 | Recalibration log | EMPTY |
| `moneyline_results` | 0 | Moneyline settlement results | EMPTY |
| `prop_settlement_audit_log` | 0 | Settlement audit trail | EMPTY |

**Orphaned/disconnected**: `bets_executed`, `parlays`, `moneyline_results`, `prop_results`, `prop_settlement_audit_log` — all empty with no active UI writing to them.

**Missing tables**: Deposit/withdrawal log per book, promo/bonus tracking, alerts/notifications for betting, Wealth Engine linkage table.

#### SECTION 2: PLATFORM REQUIREMENTS CHECK

| System | Status |
|--------|--------|
| **Live odds ingestion** | PARTIAL — SportsDataIO connected for NBA schedules/stats but not live odds feeds |
| **Odds comparison across books** | PARTIAL — LineShopping page exists, queries `sportsbook_lines` but only 1 row |
| **Line movement alerts** | MISSING |
| **SportsDataIO integration** | EXISTS — API key configured, `nba-stats-engine` and `nba-moneyline-engine` use it |
| **Game schedules/results** | EXISTS — `nba_games_today` has 33 rows |
| **Player props data** | EXISTS — 1,407 AI-generated props |
| **Implied probability calculator** | PARTIAL — exists in simulation logic |
| **EV calculator** | PARTIAL — in `bets_simulated` calculations |
| **Edge detection** | PARTIAL — confidence scoring exists |
| **Historical accuracy tracking** | PARTIAL — tables exist but empty (`ai_confidence_corrections`) |
| **Bet log** | PARTIAL — `pick_entries` (15 rows), `bets_executed` (0 rows) |
| **Open/settled bets dashboard** | EXISTS — EntriesList page |
| **ROI tracking** | EXISTS — BettingAnalytics page with breakdown tables |
| **Bankroll tracking** | PARTIAL — table exists, 0 rows, UI not writing to it |
| **Kelly Criterion** | MISSING |
| **Risk of ruin** | MISSING |
| **Hedge calculator** | EXISTS — HedgeCenter page (static, no DB) |
| **Arbitrage detection** | MISSING |
| **AI game analysis** | EXISTS — `ai_game_predictions` (17 rows) |
| **AI recommendation engine** | EXISTS — `nba_props_generated` (1,407 rows) |
| **Sportsbook account management** | PARTIAL — platforms table seeded, no balance tracking |
| **Daily P&L** | PARTIAL — analytics page exists but `bets_executed` is empty |
| **Wealth Engine integration** | NOT CONNECTED |
| **Penthouse integration** | PARTIAL — OwnerSportsDetailPage shows hardcoded mock data |
| **Finance Floor 5 integration** | NOT CONNECTED |

#### SECTION 3: EDGE FUNCTIONS

| Function | Purpose | Connected to UI | Working |
|----------|---------|----------------|---------|
| `nba-stats-engine` | SportsDataIO player props + stats | Yes (dashboard) | Yes |
| `nba-moneyline-engine` | SportsDataIO moneyline predictions | Yes (dashboard) | Yes |
| `simulate-lines` | Line simulation | Yes (dashboard) | Yes |
| `simulate-outcomes` | Outcome simulation | Yes | Yes |
| `process-settlements` | Settle entries | Yes (entries page) | Partial |

#### SECTION 4: UI/PAGES

| Route | Purpose | State |
|-------|---------|-------|
| `/os/sports-betting/dashboard` | Main dashboard with stats, sims | Working — real data |
| `/os/sports-betting/workflow` | Betting workflow | Working |
| `/os/sports-betting/entries` | Pick entries list | Working — 15 real entries |
| `/os/sports-betting/entries/new` | Entry wizard | Working |
| `/os/sports-betting/platforms` | State compliance view | Working — real data |
| `/os/sports-betting/line-intake` | Upload sportsbook lines | Working — minimal data |
| `/os/sports-betting/line-shopping` | Compare lines across books | Working — 1 row data |
| `/os/sports-betting/settings` | Settings page | Unknown |
| `/os/sports-betting/stats-inspector` | Stats inspector | Working |
| `BettingAnalytics` (not in routes) | Full analytics with breakdowns | EXISTS but not routed in module sidebar |
| `HedgeCenter` (not in routes) | Hedge calculator | EXISTS but not routed — static HTML, no logic |
| `ParlayLab` (not in routes) | Parlay builder | EXISTS but not routed |
| `SimulationPage` (not in routes) | Simulation view | EXISTS but not routed |
| `NBADailyBoard` (not in routes) | NBA daily board | EXISTS but not routed |
| `ResultsPage` (not in routes) | Results view | EXISTS but not routed |
| `OwnerInternal` (not in routes) | Owner internal view | EXISTS but not routed |
| Owner Sports Detail | Penthouse view | HARDCODED mock data |

#### SECTION 5: DATA INTEGRATION

| Integration | Status |
|------------|--------|
| SportsDataIO | CONNECTED — API key present, NBA stats + moneyline engines functional |
| Live odds feed | NOT CONNECTED — no real-time odds aggregation |
| Results auto-ingestion | PARTIAL — `confirmed_game_winners` has 16 rows |
| Prop results settlement | NOT CONNECTED — `prop_results` empty |

#### SECTION 6: AI ENGINE

| Component | Status |
|-----------|--------|
| AI model running analysis | EXISTS — nba-stats-engine generates 1,407 props |
| Recommendation engine | EXISTS — confidence scoring, top props |
| Claude/OpenAI connected | Uses Lovable AI (LOVABLE_API_KEY present) |
| AI outputs stored | EXISTS — `nba_props_generated`, `ai_game_predictions` |
| Model accuracy tracking | MISSING — correction tables empty, no evaluation loop |

#### SECTION 7: BANKROLL + BET TRACKING

- No real bet has been logged in `bets_executed` (0 rows)
- `bankrolls` table exists but is empty — never initialized
- A user can log a pick entry (15 exist) but **cannot** see P&L because `bets_executed` is empty
- Kelly Criterion: NOT implemented
- **Break point**: The flow breaks between "entry created" and "bet executed/settled". There is no mechanism to promote a `pick_entry` to a `bets_executed` record and then settle it.

#### SECTION 8: WEALTH ENGINE INTEGRATION

| Connection | Status |
|-----------|--------|
| Wealth Engine OS | NOT CONNECTED — no data flow |
| Penthouse | PARTIAL — `OwnerSportsDetailPage` exists with hardcoded data |
| Finance Floor 5 | NOT CONNECTED |

#### SECTION 9: COMPLETION ESTIMATE

**Overall: ~35% complete**

- **Working**: SportsDataIO integration, AI prop generation (1,407 props), state compliance, platform registry, basic dashboard, entry wizard
- **Broken**: Settlement pipeline (empty), bankroll engine (empty), accuracy tracking (empty), Hedge calculator (static HTML)
- **Missing**: Live odds, Kelly Criterion, arbitrage detection, line movement alerts, Wealth Engine integration, bet execution flow, P&L tracking, sportsbook balance tracking

#### SECTION 10: TOP 5 BUILD PRIORITIES

1. **Bet execution + settlement pipeline** — Connect pick entries to bets_executed, build settlement flow. This is the core loop. *High complexity.*
2. **Bankroll initialization + unit sizing** — Auto-create bankroll record, implement Kelly Criterion calculator, connect to entry wizard stake sizing. *Medium complexity.*
3. **Route hidden pages into module sidebar** — BettingAnalytics, HedgeCenter, ParlayLab, NBADailyBoard, ResultsPage are built but not accessible. *Low complexity.*
4. **Model accuracy tracking loop** — After settlement, compare AI predictions vs actual results, write to `ai_confidence_corrections`. *Medium complexity.*
5. **Penthouse integration** — Replace hardcoded mock data in OwnerSportsDetailPage with real queries from betting tables. *Low complexity.*

#### SECTION 11: FIRST 3 LOVABLE BUILD PROMPTS

**Prompt 1** — Route hidden pages:
> In `src/modules/betting/index.ts`, add the following pages to both `sidebarItems` and `routes`: BettingAnalytics at `/analytics`, HedgeCenter at `/hedge`, ParlayLab at `/parlay-lab`, NBADailyBoard at `/nba-board`, ResultsPage at `/results`. Import them from `@/pages/os/betting/`. Do not modify the existing pages.

**Prompt 2** — Bet execution pipeline:
> Build a "Place Bet" flow: When a user views a pick entry on the Entries page, add a "Mark as Placed" button. This should insert a row into `bets_executed` with the entry details (game, bet type, odds, stake from the pick_entry). Add a "Settle" button that marks the bet as won/lost/push and updates the `bets_executed` record. Connect this to the bankroll — auto-create a bankroll record if none exists for the user. Use existing tables only.

**Prompt 3** — Penthouse real data:
> In `src/pages/owner/OwnerSportsDetailPage.tsx`, replace all hardcoded mock data with real Supabase queries. Bankroll from `bankrolls` table, recent bets from `bets_executed` joined with `pick_entries`, win rate calculated from settled bets. If no data exists, show empty state instead of fake numbers.

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/communication/messaging/AICampaignTab.tsx` | Fix TS2589 — cast `supabase.from("profiles")` as `any` |

