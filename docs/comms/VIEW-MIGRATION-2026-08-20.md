# Comms view migration — status and store_id carry cost

**Date:** 2026-08-20
**Scope:** the four hand-merge callers of the comms views.

## 1. Store-facing callers — already off their own merges

| Caller | Source | Status |
|---|---|---|
| `useStoreCallHistory` | `v_store_comms_detail` | migrated |
| `ContactCommunicationTimeline` | `v_store_comms_detail` | migrated |

Column-coverage check (the "tidy-up that loses a column" test) against what those two
render today: direction, channel, status, outcome, duration, phone, summary, body,
transcript, recording_url, performed_by, is_ai, provider_sid, contact_id, occurred_at.
All present in `v_store_comms_detail`. No render regression. `ContactCommunicationTimeline`
also needs `provider_sid` for the Bland `call_id` used by the analysis/transcript panels —
carried.

So a store calling or texting back lands on the store profile through one SQL merge, not
four client queries.

## 2. `store_id` on `v_comms_touch_stream` — cost of carrying it

`store_id` was already on the stream as a **row-level** column only (id stamped on the
source row). Coverage was 194 / 3,886 touches = 5%.

Two candidate resolution strategies were measured before adding anything:

| Approach | Full-stream latency |
|---|---|
| `LATERAL` lookup into `store_contacts` per row (no index) | **12,037 ms** |
| Pre-aggregated hash-join phone maps | **22 ms** (36 ms with a group-by on top) |

The lateral form is unusable; the hash-join form is free. Shipped the hash-join form, plus
two supporting expression indexes on last-10 phone (`store_contacts`, `stores`) so the maps
stay cheap as the tables grow.

## 3. What resolves, and what deliberately does not

Resolution order, recorded per row in the new `store_id_source` column:

1. `row` — id already on the source row (194)
2. `contact_phone` — **unique** `store_contacts` phone match (7)
3. `store_phone` — **unique** `stores.phone` match (15)
4. `NULL` — everything else (3,670), left visible

Sources that cannot resolve a store, and why:

- `brandaro_ai_calls` (379), `va_call_logs` (319) — Brandaro lead universe, no store relation at all.
- `twilio_call_logs` (66), `bland_call_logs` (21) — raw provider logs, no entity link and no contact match.
- `sbo_sms_log` (108) — betting line; see below.
- `dynasty_ai_calls` (177), `dc_call_logs` (137) — call-level rows whose numbers mostly match
  more than one store's contacts.

**Ambiguity is left NULL on purpose.** 814 `communication_logs` rows and 794
`outbound_messages` rows have a last-10 that maps to *more than one* store contact. Those
resolve to nothing rather than to the first match. Visibly incomplete beats silently wrong —
same rule as the phone nulls.

**One false positive was caught and excluded.** All 108 `sbo_sms_log` rows share the number
`718-427-8155`, which is also the main phone on store `11236 (8021 AVE K)`. A blanket
`stores.phone` fallback would have hung the owner's entire betting-bot thread on that store's
profile. The `stores.phone` step is skipped for SBO traffic.

## 4. `FinishedCallsBoard` and `ConversationsTab` — NOT migrated, and why

These two cannot move onto `v_comms_touch_stream` without a visible regression. The stream is
a *touch index* — who was contacted, when, on which channel, with what outcome. It carries no
content. What the two components render that the stream does not have:

`FinishedCallsBoard`: `agent_name` / `agent_id`, `from_number` **and** `to_number` as separate
fields (it renders `from → to`), `contact_name`, `company_name`, `recording_url`, raw
`transcript`, `duration_seconds`, `call_ended_at`, plus the `dynasty_call_analysis` /
`dc_lead_analysis` enrichment (sentiment, score, utterance count).

`ConversationsTab`: message `body`, `campaign_name` / `campaign_id`, `ai_generated`, and the
live Twilio API pull that backfills messages never mirrored into a table.

Three of those — `recording_url`, `transcript`, message bodies — are **permanently forbidden**
on this view by its `public_view_contracts` row. Migrating those components would either lose
columns users read today or force content into a view built specifically not to carry it.

The correct move for them is a *second* content-bearing view (the `v_store_comms_detail`
shape, widened past store scope), not this one. Not started — logged here so the next reader
does not mistake it for an oversight.

## 5. Incidental fix

`FinishedCallsBoard` played recordings through a raw `<audio src={c.recording_url}>`, which
bypasses the private-bucket proxy. Replaced with `RecordingPlayer`.
