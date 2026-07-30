# SBO AI Engine — User Guide

**Last verified against live system: July 30, 2026**
Audience: (1) Owner/Operator, (2) Staff/VA.
This is an honest guide. Broken and stale pages are labeled as such on purpose.

---

## 1. What This System Does

SBO AI Engine is a sports-betting intelligence system with two separate data streams feeding one database.

**Stream 1 — Telegram capper picks.** Screenshots and messages from ~90 tracked handicappers ("cappers") in Telegram groups get pulled in automatically, read by AI, and turned into structured picks: who posted it, what sport, what bet type, the line, the odds. Once games finish, those picks are graded win/loss/push automatically for the sports we have result feeds for. Over time this builds a track record per capper so you can see who's actually good instead of who talks the loudest. This stream is the healthiest part of the system today — roughly 2,900 picks came in over the last 7 days and about 1,500 got graded in that same window.

**Stream 2 — Internal AI predictions.** The system pulls live odds and player props from betting markets, runs them through several scoring "brains" (market pricing, player stats, situational context), and produces its own prediction with a confidence score. This stream is currently much thinner than stream 1. It works for MLB player props, but because we don't yet have a real baseball stats feed, those predictions run on market odds alone and are deliberately capped at low confidence. Game-level moneyline predictions were switched off system-wide on 2026-07-22.

**How they're meant to work together vs. reality.** The intended design is convergence: when a respected capper posts a pick *and* the internal AI independently likes the same side, that's your strongest signal. In practice, today, the two streams mostly run in parallel. The pages built to merge them (Signal Alignment, Profit Center, Wallet Intelligence) depend on tables that are currently empty, so the merge is not producing usable output yet. Treat capper tracking and AI predictions as two separate tools for now.

---

## 2. Owner / Operator Section

### 2a. Daily Workflow — What To Check, In Order

1. **⚙️ Sync** (`/sbo-ai-engine/sync`) — Confirm last night's and this morning's engine runs finished. If a run says `partial` or `failed`, everything downstream is suspect. Runs fire at 13:00 UTC (morning) and 23:00 UTC (pre-game); grading runs ~04:00 UTC.
2. **🩺 Health** (`/sbo-ai-engine/health`) — One screen showing how many games, props, and predictions exist for today and whether stats context got built. Fastest "is anything actually flowing" check.
3. **🎯 All Picks** (`/os/sbo/picks`) — Review the overnight capper intake. This is where new Telegram picks land. Look for picks attributed to a channel name instead of a person (see 3b) and for anything marked unsupported.
4. **📊 Capper Intelligence** (`/sbo-ai-engine/capper-intelligence`) — Who's hot, who's cold, who's graded well over time. This is the highest-value page in the system right now.
5. **🌙 Nightly Board** (`/sbo-ai-engine/nightly`) — Today's games, props, and any AI predictions. Anything with an **Odds Only** badge is low-information — read section 2c before acting on it.
6. **📜 History** (`/sbo-ai-engine/history`) — Only if you want to look back at prior predictions and how they resolved.

**Currently pointless to check daily — don't waste the clicks:**

- 💰 Profit Center — bankroll and logged bets tables are empty; it renders zeros.
- 🔮 Wallet Intelligence — Polymarket wallet tables have zero rows; the page is blank by design of the missing feed.
- ⚡ Signal Alignment — half its inputs (wallet events, logged bets) are empty, so alignment scores don't compute.
- 📱 My Bets — no bets have ever been logged into it.
- ⚡ Prop Intelligence Hub — its data source stopped updating in April (NBA-only).
- 📈 Accuracy / 🧬 Model Intel — no new graded predictions since mid-June, so the numbers haven't moved.

---

### 2b. What Each Sidebar Route Actually Does

#### 🎯 SBO Cockpit — `/os/sports-betting/ai-os`
- **For:** The original all-in-one console: games, odds, predictions, parlays, model weights, briefings, all as tabs.
- **Today:** The games/odds/predictions tabs populate. Bankroll, logged-bets, parlay, and hedge tabs are empty because those tables have no rows. It's heavy and slow to load.
- **STATUS:** ⚠️ Partially working — data tabs fine, money/bankroll tabs empty.
- **Use when:** You want everything on one screen. Otherwise use the focused pages below.

#### 🌙 Nightly Board — `/sbo-ai-engine/nightly`
- **For:** Tonight's slate — games, player props, and the AI's take on them.
- **Today:** Shows current MLB games and props (316 props pulled in the last 7 days), plus the handful of MLB prop predictions the engine produced. Each prediction carries a data-quality badge.
- **STATUS:** ✅ Working.
- **Use when:** Daily, step 5.

#### 🏀 Tonight — `/sbo-ai-engine/tonight`
- **For:** Just today's game list with odds, no prop detail.
- **Today:** Populated for whatever sports the odds fetch pulled — currently MLB. NBA is out of season, so NBA sections are empty (that's correct, not a bug).
- **STATUS:** ✅ Working.
- **Use when:** Quick "what's on tonight" glance.

#### ⚡ Prop Intelligence Hub — `/sbo-ai-engine/prop-hub`
- **For:** Deep per-prop research: season/L5/L10 averages, matchup context, cross-book comparison.
- **Today:** Reads a separate props table that is NBA-only and whose newest game date is **2026-04-24** — end of the NBA season. It renders old April data. The buttons on it (collect stats, expand context, settle results) target that same stale NBA pipeline.
- **STATUS:** 🔴 Stale since late April 2026 — the feed behind it was never extended to MLB.
- **Use when:** Skip this one for now.

*Note:* `/sbo-ai-engine/props`, `/props-intelligence`, `/parlay`, `/prizepicks`, and `/bovada` all redirect here.

#### 💎 Value Spots — `/sbo-ai-engine/value`
- **For:** Surfacing predictions where the AI disagrees meaningfully with the market.
- **Today:** Because only 7 MLB prop predictions exist and they're all clamped to low confidence, it surfaces almost nothing.
- **STATUS:** ⚠️ Partially working — the logic runs, there's just barely any qualifying input.
- **Use when:** After prediction volume grows. Low value today.

#### 📈 Accuracy — `/sbo-ai-engine/accuracy`
- **For:** Hit rate of the AI's own predictions over time.
- **Today:** 43 historical accuracy records, all from the NBA season. No prediction has been graded since **2026-06-13** because the graders only understand NBA/SportsDataIO and there is no MLB score feed wired in yet.
- **STATUS:** 🔴 Stale since mid-June 2026.
- **Use when:** Skip until MLB results grading is built.

#### 🧬 Model Intel — `/sbo-ai-engine/model`
- **For:** How the AI weighs its scoring brains, and self-adjustments over time.
- **Today:** 5 performance records, frozen. Weight adjustment depends on graded results, which have stopped.
- **STATUS:** 🔴 Stale — downstream of the grading gap above.
- **Use when:** Skip for now.

#### 📱 My Bets — `/sbo-ai-engine/my-bets`
- **For:** Logging bets you personally placed and tracking their P&L.
- **Today:** Zero rows have ever been entered. Page renders an empty state.
- **STATUS:** ⚠️ Functional but unused — it works, nobody has used it.
- **Use when:** Only if you decide to start logging real bets manually.

#### 🔮 Wallet Intelligence — `/sbo-ai-engine/wallet-intelligence`
- **For:** Tracking sharp Polymarket wallets and what they're buying.
- **Today:** All three backing tables (tracked wallets, wallet events, wallet scores) have **zero rows**. The wallet-tracking ingestion was never turned on.
- **STATUS:** 🔴 Broken/empty — no feed behind it.
- **Use when:** Skip this one.

#### 📊 Capper Intelligence — `/sbo-ai-engine/capper-intelligence`
- **For:** The scoreboard for your ~90 tracked cappers — record, ROI, streaks, best sport, best market.
- **Today:** Genuinely live. 398 capper performance records, 3,270 total picks, ~1,500 graded in the last week. Some panels on this page (bet log, betting wallet) read empty tables and will show blanks.
- **STATUS:** ✅ Working (with a couple of empty side panels).
- **Use when:** Daily. This is the best page in the system.

#### ⚡ Signal Alignment — `/sbo-ai-engine/signal-alignment`
- **For:** Cross-referencing capper picks, AI predictions, and sharp wallet activity to find agreement.
- **Today:** Capper picks and predictions load, but wallet events and logged bets are empty, so most alignment scores can't compute and the page looks half-blank.
- **STATUS:** ⚠️ Partially working — two of four inputs missing.
- **Use when:** Skip until wallet tracking exists.

#### 💰 Profit Center — `/os/sports-betting/profit-center`
- **For:** Bankroll, staking, realized profit.
- **Today:** Bankroll and actual-bets tables are both empty. Everything reads $0.
- **STATUS:** 🔴 Empty — nothing has ever been recorded here.
- **Use when:** Skip unless you start logging real bankroll data.

#### 💹 Hedge Center — `/os/sports-betting/hedge-center`
- **For:** Hedge and arbitrage math across sportsbooks.
- **Today:** The arbitrage table is empty (no scanner is running). The manual hedge calculator on the page still works if you type numbers in yourself.
- **STATUS:** ⚠️ Partially working — calculator yes, auto-detected arbs no.
- **Use when:** Manually computing a hedge on a bet you already have.

#### ⚡ Simulation — `/sbo-ai-engine/simulation`
- **For:** Running "what if I'd bet this strategy" simulations.
- **Today:** 6 saved simulations exist. It runs, but results are only as good as the thin prediction history behind them.
- **STATUS:** ⚠️ Partially working — functional, weak inputs.
- **Use when:** Exploratory only; don't make decisions off it yet.

#### 📜 History — `/sbo-ai-engine/history`
- **For:** Browsing past AI predictions and their outcomes.
- **Today:** 1,672 predictions total are browsable. Most recent ones show as unresolved because grading has stalled.
- **STATUS:** ✅ Working for browsing, ⚠️ outcomes column is incomplete.
- **Use when:** Looking back at what the AI called on a given date.

#### 📱 ChingWorld SMS — `/sbo-ai-engine/sms`
- **For:** Sending the daily picks briefing out by text.
- **Today:** 108 sends logged; the most recent went out **2026-07-22**. The daily briefing generation step still runs nightly, but it's been producing empty briefings (no qualifying picks), so nothing has gone out since.
- **STATUS:** ⚠️ Plumbing works, content pipeline dry.
- **Use when:** Only if you want to manually push a briefing.

#### 🩺 Health — `/sbo-ai-engine/health`
- **For:** Today's data-coverage snapshot: games, props, predictions, stat context.
- **Today:** Accurate and current.
- **STATUS:** ✅ Working.
- **Use when:** Daily, step 2.

#### ⚙️ Sync — `/sbo-ai-engine/sync`
- **For:** Engine run log — every scheduled sync, step by step, with pass/warn/fail and record counts.
- **Today:** Fully current; last runs are from today. Steps marked NBA-only will show as warnings/skips during MLB season — that's expected, not a failure.
- **STATUS:** ✅ Working.
- **Use when:** Daily, step 1, and any time something looks stale.

#### 📋 VA Entry — `/sbo-ai-engine/va-entry`
- **For:** A simplified screen for a VA to hand-enter props from a screenshot.
- **Today:** The form works, but zero VA sessions have ever been recorded — it's unused in practice.
- **STATUS:** ⚠️ Functional but unused.
- **Use when:** Manual prop entry, if you choose to staff it.

#### 🧭 SBO Dashboard — `/os/sbo`
- **For:** Lightweight daily summary of capper picks plus combined signals.
- **Today:** The capper-picks half populates. The "signals" half reads a table with **zero rows**, so that section is always empty.
- **STATUS:** ⚠️ Partially working — half the page is dead.
- **Use when:** `/os/sbo/picks` is more useful; prefer that.

#### 🎯 All Picks — `/os/sbo/picks`
- **For:** The full searchable/filterable feed of every capper pick ingested.
- **Today:** 3,270 picks, newest from this morning. Filterable by sport, bet type, capper, result.
- **STATUS:** ✅ Working.
- **Use when:** Daily, step 3, and any time you're reviewing intake quality.

---

### 2c. Known Limitations — What They Actually Mean For You

- **MLB predictions are deliberately weak.** We have no baseball stats feed, so MLB props are predicted from market odds alone. Any prediction produced this way is tagged **Odds Only** and hard-capped at 54/100 confidence ("Weak") no matter how good it looks. That cap is intentional — it exists so a low-information guess can never masquerade as a strong play. Don't read a 54 as a real edge.
- **Moneyline predictions are off system-wide.** Turned off 2026-07-22 because the outcome-derivation logic was incomplete and it was producing junk. The step still appears in the sync log; it reports "0 invoked — disabled." That is expected.
- **Prediction grading has stopped.** No AI prediction has been graded since 2026-06-13. Both graders are hardcoded for NBA via SportsDataIO, and there's no MLB score feed, so MLB games never move out of "upcoming." This is why Accuracy and Model Intel are frozen. Capper pick grading is a *different* pipeline and is working fine.
- **Capper grading covers MLB, NBA, and WNBA only.** Tennis, UFC, soccer, golf, CFL, NFL picks come in and get stored but stay "pending" forever. Props and parlays also can't be auto-graded — a large chunk of prop and parlay picks are flagged `unsupported`. That's a known gap, not a data error.
- **NBA is out of season.** Several sync steps (season stats, projections, PrizePicks, Polymarket) are NBA-only and will report zero records or warnings until the NBA season restarts. Not a failure.
- **The "money" layer is empty.** Bankroll, logged bets, and Polymarket wallet tracking have never been populated. Every page built on top of them (Profit Center, My Bets, Wallet Intelligence, most of Signal Alignment) reads zero.

---

## 3. Staff / VA Section

### 3a. Common Tasks — Step By Step

**Task 1 — Confirm the overnight sync actually ran**
1. Open **⚙️ Sync** in the sidebar (under SBO AI Engine).
2. Look at the top row of the run list — it should show today's date.
3. Check the **Status** column: `completed` is good, `partial` means some steps failed, `failed` is a problem.
4. Click the row to expand the step list. Steps showing NBA-related names with 0 records during summer are **normal**.
5. If today's run is missing entirely, tell the owner — do not try to re-run it yourself.

**Task 2 — Manually trigger a sync**
1. Open **⚙️ Sync**.
2. Use the run/trigger button at the top of the page.
3. Wait — a full run takes 20–60 seconds. Don't click twice.
4. When it finishes, a new row appears at the top of the run list. Expand it and check for failed steps.

**Task 3 — Review this morning's capper picks**
1. Open **🎯 All Picks** (`/os/sbo/picks`).
2. Sort or filter by newest first.
3. Scan the **Capper** column for anything that looks like a channel/group name rather than a person's handle (see 3b).
4. Scan the **Sport** and **Bet Type** columns for obviously wrong parses (e.g., a golf pick labeled MLB).
5. Note anything suspicious and pass it to the owner. Do not delete picks.

**Task 4 — Check a capper's track record**
1. Open **📊 Capper Intelligence**.
2. Find the capper in the list (search by name).
3. Their record, ROI, streak, and best sport display on their row/card.
4. If total picks is very low (under ~20), treat the win rate as noise.

**Task 5 — Refresh today's data coverage**
1. Open **🩺 Health**.
2. Read the counts for games, props, and predictions for today.
3. If props > 0 but predictions = 0, the prediction step didn't run — check **⚙️ Sync** for a failed step.
4. Use the context-build button on the page only if the owner asks.

**Task 6 — Manually enter props from a screenshot**
1. Open **📋 VA Entry**.
2. Enter player name, team, stat type, line, and over/under odds.
3. Save each prop before starting the next.
4. Only do this when specifically asked — the automated feed covers most of it.

---

### 3b. What To Do If Something Looks Wrong

**"A pick shows the channel/group name instead of a real capper name."**
This is usually **normal**. When a Telegram message doesn't clearly identify who posted it, the system falls back to the channel name so the pick isn't lost. The fallback order is: (1) recognized per-poster identity, (2) name extracted from the image if it's clean enough, (3) the channel/group name. Seeing a channel name means the first two didn't apply.
It's a **real bug** only if: the same person's picks are landing under *different* names on different days, or a pick shows a name that's clearly image watermark junk (random spacing, garbled text). Report those with a screenshot.

**"There are two entries for what looks like the same capper."**
Report it. Duplicates from spacing/watermark differences have happened before and are fixed by merging the two records and adding an alias — an owner-level action, not something to do yourself.

**"A prediction says only 54% / Weak even though it looks like a great play."**
Expected. Every MLB prediction is capped at 54 because we have no baseball stats feed. Look for the **Odds Only** badge. This is not a bug.

**"The Accuracy or Model page hasn't changed in weeks."**
Expected. Prediction grading has been stalled since 2026-06-13 pending an MLB results feed. Don't report it as new.

**"A page is completely empty."**
Check section 2b first. Profit Center, My Bets, Wallet Intelligence, and half of Signal Alignment and SBO Dashboard are empty because their data sources have never been populated. That's the known state, not a crash.

**"Prop Intelligence Hub shows games from April."**
Expected. That page runs off an NBA-only feed that stopped updating at the end of the NBA season. Skip the page.

**"NBA sections are empty."**
Expected — NBA is out of season. MLB is the active sport right now.

**"The daily SMS didn't send."**
Expected since 2026-07-22. The briefing generator runs but has been producing empty briefings because no picks clear the confidence bar. Nothing is broken in the SMS plumbing itself.

---

## 4. Change Log / Last Verified

- **Generated:** 2026-07-30
- **Verified against:** live database and live route/sidebar definitions on that date, not prior documentation.

**Recent changes reflected here:** MLB player props now flow end to end and produce real (low-confidence, Odds Only) predictions; the day engine runs a per-sport loop covering NBA and MLB; capper attribution was fixed so per-poster identity beats channel fallback; a duplicate capper record was merged; `odds_only` predictions are hard-capped at 54/Weak and 39 historical rows were retroactively corrected; the day engine now reports `warning` instead of `success` when a required step returns zero records.

**This guide goes out of date quickly.** Prediction volume, which sports are in season, and which feeds are live all shift week to week. Re-generate this document rather than trusting it months from now. If a page's behavior contradicts what's written here, believe the page.
