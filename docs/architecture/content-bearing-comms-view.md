# Why hand-merges still exist in comms, and what would replace them

**Date:** 2026-08-20
**Status:** SPEC — not built. Written so the answer is read, not re-derived.

## The short answer

`v_comms_touch_stream` is a **touch index**: who was contacted, when, on which channel, with
what outcome. Its `public_view_contracts` row forbids `recording_url`, `transcript` and
message bodies — deliberately, because it is the widest-scoped comms surface we have and
content is the part that must stay scoped.

`v_store_comms_detail` is **content-bearing but store-scoped**: it carries bodies, transcripts
and recording URLs, and it only emits rows that resolve to a store.

Two components render content and are not store-scoped, so neither view fits:

- `FinishedCallsBoard` — all AI/DC calls across business units
- `ConversationsTab` — the SMS inbox across campaigns

They keep their own client-side merges. That is not an oversight and not laziness; it is the
absence of a third view.

## What the third view (`v_comms_content_stream`) would need

Shape: `v_store_comms_detail`'s column set, with the store-scope requirement dropped and the
call-specific fields the board renders added back.

**Columns beyond what the touch stream carries:**

| Column | Needed by | Note |
|---|---|---|
| `body` / `message_content` | ConversationsTab | the message text |
| `transcript` | FinishedCallsBoard | raw call transcript |
| `recording_url` | FinishedCallsBoard | must stay proxied at render |
| `from_number`, `to_number` | FinishedCallsBoard | as *separate* columns — it renders `from → to`. The touch stream collapses to a single `phone`. |
| `agent_id`, `agent_name` | FinishedCallsBoard | |
| `contact_name`, `company_name` | FinishedCallsBoard | |
| `duration_seconds`, `call_ended_at` | FinishedCallsBoard | |
| `campaign_id`, `campaign_name` | ConversationsTab | |
| `ai_generated` | ConversationsTab | |

**Sources to union:** `dynasty_ai_calls`, `dc_call_logs`, `messaging_messages`,
`communication_logs`, `outbound_messages`, `communication_messages`, `bland_call_logs`,
`va_call_logs`, `brandaro_ai_calls`.

**Enrichment the board currently joins client-side:** `dynasty_call_analysis` and
`dc_lead_analysis` (sentiment, overall score, utterance count). Either join them in the view
or leave them as a second query — the board's own call, but it is content the view must not
drop by accident.

## The three hard parts

1. **Scope.** Content across all business units in one view means RLS decides who reads what,
   with no store boundary to lean on. `security_invoker` plus a per-business-unit predicate,
   and a `public_view_contracts` row that says explicitly this view is authenticated-only,
   never `anon`. It must not inherit the touch stream's grants.

2. **`recording_url` in a view is not permission to render it raw.** The bucket is private and
   provider URLs are credentialed. Any consumer still goes through `RecordingPlayer`. Shipping
   the column widens the number of places that can get this wrong — see
   `docs/comms/MEDIA-SRC-SWEEP-2026-08-20.md`.

3. **The Twilio live pull.** `ConversationsTab` currently calls a Twilio edge function to
   backfill messages that were never mirrored into any table. A SQL view cannot reach those.
   Either mirror them first (the real fix) or accept that the tab keeps one non-SQL source
   and the view covers the rest.

## Cost note before anyone starts

The store-id resolution measurement on the touch stream applies here too: per-row `LATERAL`
lookups cost 12s across ~3.9k rows; pre-aggregated hash-join maps cost 22ms. Build the joins
the second way from the start.

## Decision recorded

Not scheduled. `FinishedCallsBoard` and `ConversationsTab` keep their hand-merges until this
view exists. Migrating them onto either current view would lose columns users read today or
break a contract we wrote on purpose — a regression wearing a tidy-up's clothes.
