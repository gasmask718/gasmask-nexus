# Dynasty Connect — Sales Management / Rep Performance Audit (2026-09-07)

**Read-only audit. No code, schema, or data was changed.**
Goal: support a real 6→10 agent sales team with manager → team → agent drill-down
(calls, accounts processed, outcomes, timestamps, results) by reusing the existing
sales management system.

---

## 1. What exists today

### `/communication/rep-performance`
`src/routes/AppRoutes.tsx:2774` → `src/pages/communication/dialer/RepPerformancePage.tsx`.

Two stacked layers in one page:

| Layer | Component | Source |
|---|---|---|
| Top — live | `RepActivityBoard` (`src/components/communication/RepActivityBoard.tsx`) | `communication_logs` + `profiles` + `store_master` |
| Bottom — labelled SIMULATION | `RepPerformancePage` cards + Rep Breakdown table | `rep_performance_metrics` (view over `live_call_sessions`), `call_revenue_events`, `dialer_followups` |

The page already carries its own banner: *"SIMULATION DATA — the cards and table below
reflect simulated call outcomes, not live revenue"* (`RepPerformancePage.tsx:81-84`).

### Other performance surfaces (parallel, not merged)
| Surface | Key | Notes |
|---|---|---|
| `VALeaderboard` (`/va` portal) | `va_leaderboard_stats.va_id` | per-agent dial/answer/close counters |
| Brandaro VA dashboards / `AdminVAMonitor` | `va_call_logs.va_id`, `va_sessions.va_id` | real per-VA call rows w/ disposition, recording, duration |
| Dynasty Connect DC pages | `dc_call_logs.agent_id` / `agent_type` | mixes Bland AI agents and human agents |
| `usePerformanceLeaderboard.ts` | `person_type` string ('drivers'/'bikers'/'ambassadors') | **not per-person** — group buckets with an invented scoring formula |

---

## 2. REAL vs SIMULATED vs EMPTY (measured 2026-09-07)

| Element | Table/view | Rows | Verdict |
|---|---|---|---|
| Rep Breakdown table | `rep_performance_metrics` (view on `live_call_sessions`) | **0** | Empty. Renders "No rep data yet". Simulation-fed by design. |
| Total Revenue card | `call_revenue_events` | **0** | Always $0. Revenue is not modelled anywhere for calls. |
| Total Dials / Connects | same view | 0 | Empty |
| Pending follow-ups | `dialer_followups` | 0 in scope | Empty |
| Caller Activity board | `communication_logs` | 1,274 in 90d | **Real rows, broken attribution** (see §3) |
| Power dialer attempts | `dialer_call_attempts` (has `agent_user_id`) | 2 ever, 0 in 30d | Schema real, unused |
| VA call rows | `va_call_logs` | 320 rows / 4 VAs, latest 2026-09-04 | **Real, per-agent, with disposition + duration** |
| VA sessions (login/talk windows) | `va_sessions` | 301 rows / 10 VAs | **Real per-agent timestamps** |
| VA leaderboard counters | `va_leaderboard_stats` | 34 rows / 4 VAs, mostly 2026-08-18 | Real but stale/partial; `calls_closed` always 0 |
| DC call logs | `dc_call_logs` | 140 (109 non-Bland / 10 agent ids), 33 in 30d | Real, but last 30d are **inbound Brandaro** rows, not agent outbound |
| Manual call logs | `manual_call_logs` | 126 / 2 callers, last 2026-04-01 | Stale, abandoned path |
| Dispositions table | `call_dispositions` | **0** | Unused; real dispositions live on `va_call_logs.disposition` and `dc_call_logs.outcome` |
| Account activity | `v_store_activity` | 1,765 in 30d | Real, but see actor gap in §3 |
| Telephony mode | `dialer_settings` | 1 row (Grabba R Us) = `live` | Only one business configured at all |

**Nothing on the page is fake-generated at render time** — no `Math.random`, no mock arrays.
The simulated half is simply an empty simulation pipeline. The real half is under-attributed.

---

## 3. The attribution problem (the actual blocker)

1. **`communication_logs` has no individual actor.** In the last 90 days:
   `created_by` populated on **0** of 1,274 rows; `performed_by` populated on 1,244 rows
   but the value is the literal string **`'system'`** for every one of them.
   → The Caller Activity board collapses the whole company into one "system" row.
2. **`performed_by` is `text`, not a user id.** It cannot be joined to `profiles`.
   `RepActivityBoard.tsx:38-53` builds its name map from `created_by` only, so even when a
   real id lands in `performed_by`, the row label falls back to a raw value.
3. **Accounts processed is near-zero.** `store_id` set on only **30 of 1,274** comms rows,
   so the "Accounts" column and the store drill-down are mostly "no account linked".
4. **`v_store_activity.actor_id` is sparse by kind**: notes 78/8,881 · reviews 68/68 ·
   samples 5/5 · **calls 0/16 · texts 0/39 · routes 0/65 · invoices 0/950**.
5. **Outcomes**: `outcome` set on 7 of 1,274 comms rows. Dispositions that *do* exist are in
   `va_call_logs.disposition` (real) — a table the rep-performance page never reads.

---

## 4. Team / manager modelling

- The **only** grouping that exists and is populated is `business_members(user_id, business_id, role)` — 33 rows:
  GasMask 7 va + 1 owner · Grabba R Us 7 va + 1 owner · Brandaro 5 va · UT 1 va, plus owners elsewhere.
- `brandaro_team_hierarchy` — **0 rows**. `supervisor_performance_snapshots` — **0 rows**.
  No `teams`, `manager_id`, or `supervisor_id` in use anywhere on these pages.
- **Therefore: manager → team → agent does not exist as data today.** Only company → member.
  Per the brief, no manager relationships were invented in this audit.

---

## 5. What can be reused (no new dashboard needed)

- **The page shell and drill-down UX** of `RepActivityBoard` (rep row → expand → per-event
  timestamp / channel / direction / outcome / link to the exact account) is exactly the
  required shape. It needs a correct actor key, not a rewrite.
- **`va_call_logs` + `va_sessions`** already give per-agent calls, durations, dispositions,
  recordings and shift windows for 4–10 agents. This is the best existing agent-truth source.
- **`business_members`** already scopes agents to a company and is RLS-wired.
- **`dialer_call_attempts.agent_user_id`** is the correct, already-designed column for
  power-dialer agent attribution — it is simply not being written.
- **`v_store_activity`** already unifies "accounts processed" per store; it needs actor fill,
  not a second activity system.

## 6. Exact missing pieces

| # | Missing | Impact |
|---|---|---|
| M1 | A real user id on every comms row (`created_by`, or a new uuid actor column — `performed_by` is text and holds `'system'`) | No per-agent calls/texts |
| M2 | `store_id` stamped on comms rows created from an account screen | "Accounts processed" unusable |
| M3 | `actor_id` on call/text/route rows feeding `v_store_activity` | Activity drill-down has no owner |
| M4 | One canonical per-agent rollup that unions `va_call_logs`, `dc_call_logs`, `communication_logs` and `dialer_call_attempts` — today each page reads a different one | Four disagreeing leaderboards |
| M5 | A team layer: `sales_teams` + `sales_team_members(user_id, team_id, role manager/agent)` — nothing exists | No manager → team drill-down |
| M6 | Agreed outcome vocabulary across `va_call_logs.disposition`, `dc_call_logs.outcome`, `communication_logs.outcome` | Outcomes can't be summed |
| M7 | Backfill decision for historic `'system'` rows (they are genuinely unattributable) | Historic view must show "Unattributed", never guess |

**Explicitly NOT missing — do not build**: revenue per rep, commissions, quotas.
`call_revenue_events` is empty and no call-level revenue is modelled. Leave the simulated
revenue block as-is (or hide it) rather than inventing numbers.

---

## 7. Safest implementation plan (staged, reversible)

**Stage 0 — truth-first, zero schema change (safe now)**
- Fix `RepActivityBoard` name resolution so it maps whichever actor column holds a uuid, and
  renders `'system'` / null as an explicit **"Unattributed / automated"** row rather than a rep.
- Hide or collapse the simulated revenue block behind a clearly-labelled "Simulation" toggle
  so managers never read $0 revenue as a result.
- Add `va_call_logs` + `va_sessions` as a second real panel on the same page (per-agent calls,
  talk time, dispositions, last activity) — reuses the existing page, no new dashboard.

**Stage 1 — start attributing new activity (small, additive writes)**
- Stamp the signed-in user id and the `store_id` on every comms row written from an account,
  dialer or Auto Dial screen. New data only; no backfill, no destructive change.
- Write `dialer_call_attempts.agent_user_id` on the power-dialer path (column already exists).

**Stage 2 — one canonical agent rollup (view only, no new tables)**
- Create a single read-only view (e.g. `v_agent_activity`) unioning the four real sources with
  a normalised `agent_user_id`, `occurred_at`, `channel`, `outcome`, `store_id`, `business_id`.
  Point rep-performance, the VA leaderboard and DC at it so all pages agree.
- Register it in `public_view_contracts` per the public-view rule; `security_invoker = true`.

**Stage 3 — the team layer (only once Stage 1 data is flowing)**
- Add `sales_teams` and `sales_team_members` (member role `manager` | `agent`), scoped by
  `business_id`, with GRANTs + RLS. Manager sees own team; owner/admin sees all.
- Add manager → team → agent drill-down on the **existing** page, not a new one.

**Stage 4 — outcomes & results**
- Map the three disposition vocabularies to one shared list, surface counts per agent/team.
- Revisit revenue only if and when a real per-call revenue source exists.

**Risk notes**: Stages 0–2 are read-side or additive and reversible. Stage 3 is the only new
schema and should wait until Stage 1 proves attribution is landing on live agent traffic.
Existing simulated tables (`live_call_sessions`, `call_revenue_events`, `rep_performance_metrics`)
should be left in place — removing them would break the dialer console pages that write them.
