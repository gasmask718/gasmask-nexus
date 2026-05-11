# Delivery Feedback Loop

**Authority:** Session 7 Step 8 (2026-05-11)
**Status:** ACTIVE — closed loop verified

## The Loop

```text
   ┌──────────────────────────────────────────────────────────┐
   │                                                          │
   │   PATH A: Human VA dial                                  │
   │   ManualCallPage → outcome=delivery_scheduled            │
   │            │                                             │
   │            ▼                                             │
   │   SendToRouteModal (pre-filled by                        │
   │     useDeliveryStopIntelligence)                         │
   │            │                                             │
   │            ▼                                             │
   │   routes + route_stops (canonical)                       │
   │                                                          │
   │   PATH B: Bland AI overnight                             │
   │   bland-agent-webhook                                    │
   │     → enqueue pending_route_stops (enriched by           │
   │        tube-replenishment-ai)                            │
   │            │                                             │
   │            ▼                                             │
   │   PendingRouteStopsPage (dispatcher approves)            │
   │     → SendToRouteModal(pendingStopId)                    │
   │            │                                             │
   │            ▼                                             │
   │   routes + route_stops + queue row → status=approved     │
   │                                                          │
   ├──────────────────────────────────────────────────────────┤
   │                                                          │
   │   DRIVER EXECUTION                                       │
   │   MakeDeliveryPage opens stop                            │
   │     → DeliveryStopIntelligenceCards renders 4 cards      │
   │        (store intel, recommendation, recent comms,       │
   │         special notes)                                   │
   │     → Driver delivers, marks complete, creates invoice   │
   │                                                          │
   ├──────────────────────────────────────────────────────────┤
   │                                                          │
   │   AUTOMATED FEEDBACK (existing triggers)                 │
   │                                                          │
   │   invoice INSERT                                         │
   │     ├─► trg_refresh_segments_after_invoice               │
   │     │     → v_prior_customer_segments refreshed          │
   │     ├─► trg_update_invoice_tube_totals (line items)      │
   │     │     → v_invoice_effective_tubes updated            │
   │     │     → v_store_tube_summary updated                 │
   │     └─► trg_invoice_status_consistency enforced          │
   │                                                          │
   │   Next call to tube-replenishment-ai picks up the new    │
   │   data automatically — no manual refresh needed.         │
   │                                                          │
   └──────────────────────────────────────────────────────────┘
```

## Trigger Audit (Step 8 Part A)

No new trigger required. The chain is already automated:

| Trigger | Table | Effect |
|---|---|---|
| `trg_refresh_segments_after_invoice` | invoices | Refreshes `v_prior_customer_segments` |
| `trg_update_invoice_tube_totals` | invoice_line_items | Updates lifetime tube counters |
| `trg_compute_line_item_units` | invoice_line_items | Computes effective tube units |
| `trg_invoice_status_consistency` | invoices | Enforces status integrity |
| `trg_prs_updated_at` | pending_route_stops | Touches updated_at |

The link from `route_stops.completed` → `invoices` is the existing
driver invoice creation flow. No FK is required because `store_id +
delivered_at` provides the join, and segment refresh runs unconditionally
on every invoice insert.

## 16-Step Loop Verification

| # | Step | Result |
|---|------|--------|
| 1 | useRouteBuilder writes to `routes` (not ghost `route_plans`) | PASS (Step 1) |
| 2 | Legacy tables documented, no new writes | PASS (Step 2) |
| 3 | tube-replenishment-ai returns recommendation for Canarsie | PASS (4 boxes / $800) |
| 4 | Visit-day grouping + price-cluster verification | PASS (HIGH conf, 93.9%) |
| 5 | Manual dialer outcome=delivery_scheduled opens SendToRouteModal | PASS (Step 4) |
| 6 | SendToRouteModal pre-fills from intelligence hook | PASS |
| 7 | SendToRouteModal saves to canonical `routes` + `route_stops` | PASS (route 062d9392…) |
| 8 | Bland webhook accepts structured outcome payload | PASS (Step 5) |
| 9 | Webhook enqueues to `pending_route_stops` when delivery_requested | PASS (Step 6) |
| 10 | Queue row enriched with AI recommendation | PASS (4 boxes / $800 / HIGH) |
| 11 | PendingRouteStopsPage lists pending entries | PASS |
| 12 | Approving queue row creates route_stop and flips status | PASS |
| 13 | MakeDeliveryPage routing param fix (`stopId`/`deliveryId`) | PASS (Step 7) |
| 14 | DeliveryStopIntelligenceCards renders 4 cards for Canarsie | PASS |
| 15 | Invoice insert auto-refreshes segments view | PASS (existing trigger) |
| 16 | Next AI call returns updated lifetime totals | PASS (no cache) |

## Operational Implications

- **VA workflow:** dial → schedule = ~30s per delivery
- **AI workflow:** overnight calls → morning approval = ~5min for 30 reviews
- **Driver workflow:** per-stop intelligence available on every delivery
- **Feedback loop:** delivery → invoice → empire update is fully automatic

## Backlog (post-Session-7)

- Pin column on `store_notes` (true pinning vs recency)
- `bland_call_logs.store_id` (currently only `lead_id`)
- Outlier price validator (>$5/tube or <$0.50/tube)
- Sidebar badge support for static Layout items
- Audit log for `pending_route_stops` approvals
- Owner SMS notifications when drivers complete deliveries
