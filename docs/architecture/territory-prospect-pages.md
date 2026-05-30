# Territory Prospect Pages — Promote, Not Dispatch

## Canonical rule

Territory prospect pages operate on `territory_addresses` and `territory_store_candidates`. These are **pre-CRM rows** — addresses and guesses that have NOT been verified or approved as real stores. They do not have a `stores.id` (a.k.a. `store_master` id).

**Routing requires an approved `stores.id`.** RouteAssignmentDialog only accepts approved CRM stores as stops. Therefore:

- **DO NOT** wire dispatch (`RouteAssignmentDialog`) into territory prospect pages.
- **DO** wire `request_store_promotion` (the "Promote to Store" action). Promotion creates a pending promotion request; once an owner/admin approves it, the candidate becomes a real `stores` row and is then dispatchable from Stores, SellThroughAnalytics, NeighborhoodCoverage, MasterOpportunities, etc.

The lifecycle is strictly:

```text
territory_address → candidate → request_store_promotion (PENDING)
  → owner/admin approves → stores.id exists → DISPATCHABLE on routes
```

Never short-circuit this by extending `RouteAssignmentDialog` to accept raw addresses or by auto-promoting on dispatch. The promotion approval is the integrity gate that prevents unverified prospects from polluting the route network and CRM.

## Page audit (current state)

| Page | Promote action | Dispatch action | Notes |
|------|---------------|-----------------|-------|
| `VisitConsole` | ✅ Inline on visit completion — calls `request_store_promotion` with `verification_method='visit'` | ❌ Correct — pre-CRM | The visit IS the verification gate; promote is bundled with task completion. |
| `ScoutConsole` | ❌ By design — scout only classifies | ❌ Correct — pre-CRM | Scout outcomes feed `complete_territory_task` (classification only). Promotion happens in the Visit stage after a scout-confirmed candidate is visited. |
| `TerritoryCandidates` | ✅ Added — per-row "Promote" button → dialog → `request_store_promotion` with `verification_method='candidate_review'` | ❌ Correct — pre-CRM | Was a read-only table; now exposes the canonical promote path for any candidate. |
| `TerritoryGapIntelligence` | N/A | N/A | Read-only neighborhood KPIs and analytics. No row-level candidates surfaced here. |

## Where dispatch DOES belong (for reference)

Approved-store surfaces that may dispatch via `RouteAssignmentDialog`:

- `src/pages/Stores.tsx`
- `src/pages/SellThroughAnalytics.tsx`
- `src/pages/territory/NeighborhoodCoverage.tsx`
- `src/pages/MasterOpportunities.tsx` (Signals board)
- `src/pages/delivery/DriverProfile.tsx`, `BikerProfile.tsx`
- `src/pages/delivery/RouteSuggestionsPage.tsx`
- `src/components/delivery/DispatchIntakePanel.tsx`

All read from `stores` (approval_status='approved'). Prospect pages do not.

## RPC contract — `request_store_promotion`

Parameters used by the promote action:

- `p_territory_address_id` (required)
- `p_candidate_id` (optional, when promoting a candidate row)
- `p_proposed_store_name`
- `p_proposed_contact_name`
- `p_proposed_phone` (nullable)
- `p_verified_sells_tobacco` (boolean)
- `p_verified_sells_grabba` (boolean)
- `p_verification_method` — `'visit'` (from VisitConsole) or `'candidate_review'` (from TerritoryCandidates)

Outcome: inserts a PENDING `store_promotion_requests` row. Owner/Admin reviews and approves it elsewhere; only then does a `stores` row get created.
