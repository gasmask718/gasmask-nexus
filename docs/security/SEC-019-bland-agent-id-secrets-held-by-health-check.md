# SEC-019 — 13 secret slots held by Bland agent IDs with nothing behind them

**Status:** OPEN (deliberately not actioned — product decision, not engineering)
**Filed:** 2026-08-11
**Related:** secret-cap triage (100/100 dev cap), PIPE-01 slot freeing

## Finding

Thirteen `*_AGENT_ID` secrets exist solely so that `comms-health-monitor` can assert they are
present. No Bland agent has ever been created behind them, and no calling/voice function reads
them on a live path. The health check is the only consumer — a circular reference: the secrets
exist to satisfy the check, and the check exists to verify the secrets.

### The 13

| Secret | Vertical |
|---|---|
| `BRANDARO_CLOSER_AGENT_ID` | Brandaro |
| `BRANDARO_SALES_AGENT_ID` | Brandaro |
| `BRANDARO_REL_AGENT_ID` | Brandaro |
| `BRANDARO_ES_CLOSER_ID` | Brandaro (Spanish) |
| `BRANDARO_ES_REL_ID` | Brandaro (Spanish) |
| `DC_SALES_AGENT_ID` | Dynasty Connect |
| `DC_FOLLOWUP_AGENT_ID` | Dynasty Connect |
| `DC_INBOUND_AGENT_ID` | Dynasty Connect |
| `DC_REACTIVATION_AGENT_ID` | Dynasty Connect |
| `RE_CLOSER_AGENT_ID` | Real Estate |
| `RE_QUALIFIER_AGENT_ID` | Real Estate |
| `RE_SPECIALIST_AGENT_ID` | Real Estate |
| `SF_ATTORNEY_AGENT_ID` / `SF_CLIENT_AGENT_ID` | Surplus Funds |
| `TT_AMBASSADOR_AGENT_ID`, `TT_CONCIERGE_AGENT_ID`, `UT_*_AGENT_ID`, `ICLEAN_BOOKING_AGENT_ID` | adjacent block, same shape |

(The block spans seven verticals; the count of strictly health-check-only entries is 13.)

## Why it is not being deleted now

Deleting them turns `comms-health-monitor` red across seven verticals. That is noise during an
active build, and the underlying question — whether those Bland agents get built at all — is a
product roadmap decision, not a cleanup decision.

## Decision owner

Whoever owns the Bland voice-agent roadmap. Two clean outcomes:

1. **Agents are on the roadmap** — keep the secrets, populate them with real agent IDs as each
   agent is created, and the health check becomes meaningful.
2. **Agents are cancelled** — delete the 13 secrets *and* remove their assertions from
   `comms-health-monitor` in the same change, so the check stays green and 13 slots return to the
   100-secret budget.

Do not do half of either: deleting the secrets without editing the monitor is the red-dashboard
outcome we are avoiding.

## Budget impact

13 of 100 dev-environment slots. Recovering them would cover PIPE-01 plus CFG-01→03 with room
left over.
