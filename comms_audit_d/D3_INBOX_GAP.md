# D3 — INBOX GAP (Pass D)

## One-line answer
A unified inbox **exists as a UI** at `/communication/unified-inbox`, and it does
read the canonical `communication_logs` table — but it reads only that one table,
so inbound voice (`dc_call_logs`, 57 inbound rows), Brandaro inbound SMS
(`brandaro_inbound_messages`, 47 rows), voicemail and email are all invisible in
it. Two of the three inbound channels have no human-facing surface at all.

## Does any single view show all inbound? — PARTIAL

`src/pages/communication/inbox/UnifiedInboxV3Page.tsx` (route:
`AppRoutes.tsx:2582`, `/communication/unified-inbox`; `/communication/inbox`
redirects to it at `AppRoutes.tsx:2636`) [V].

Backed by `src/hooks/useUnifiedInbox.ts:59-75`:
```
.from("communication_logs")
.in("channel", ["sms","whatsapp","email","call","ai_call","voice"])
.limit(200)
```
[V] Findings:
- **Single-table.** It never joins `dc_call_logs`, `voicemails`,
  `brandaro_inbound_messages`, `unmatched_messages`, `ops_inbox_*`, or
  `brandaro_receptionist_calls`. Pass A's 13+ log tables remain unjoined —
  **no view, RPC, or query anywhere unifies them** [V].
- **Hard `limit(200)`** with no pagination — silent truncation once volume grows
  past 200 rows in the selected window [V]. `communication_logs` already holds
  1,534 rows.
- Data that *is* visible: 606 inbound SMS rows in `communication_logs`
  (newest 2026-07-28) [V]. So GasMask/store-side inbound texts *are* seen.

## Per-brand inboxes
| Route | Page | Reads | State |
|---|---|---|---|
| `/communication/unified-inbox` | UnifiedInboxV3Page | `communication_logs` | live, single-table |
| `/communication/voicemail-inbox` | VoicemailInboxPage | `voicemails` | **table has 0 rows** [V] |
| `/brandaro/inbox` (`AppRoutes.tsx:3802`) | `pages/brandaro/InboxPage.tsx` | `brandaro_pending_messages` + `brandaro_inbound_messages` | live; see below |
| `/portal/inbox` (`:2744`) | OpsInboxPage | `ops_inbox_threads` | **0 rows — never used** [V] |
| `/unforgettable/supplier-inbox` (`:3959`) | UTSupplierInbox | supplier replies | out of scope |
| DC Lead Inbox | `pages/dynasty-connect/DCLeadInbox.tsx` | `dc_call_logs` | closest thing to an inbound-voice surface |

### The Brandaro inbox is real but nobody is working it [V]
- `brandaro_pending_messages`: **2,706 `pending`**, 6 `sent`. Every outbound draft
  is sitting in an approval queue that nobody has cleared.
- `brandaro_inbound_messages`: **47 rows, 100% `resolved IS NOT true`,
  0 `ai_auto_responded`**, all created 2026-06-06 → 2026-06-07. Nothing has been
  actioned in ~8 weeks.

## Full conversation history with one contact
Closest existing surface is `src/hooks/usePhoneLog.ts` — it threads calls + SMS by
counterparty number off `communication_logs` and is genuinely good [V]. But:
- It excludes email, voicemail, `dc_call_logs` inbound and AI-call transcripts.
- It is per-store, surfaced through `StorePhoneLogSection` / `PhoneLog.tsx`, not
  an inbox.

So: **no interleaved AI-call + human-call + SMS + email timeline exists** [V].

## Assignment
No assignment model on inbound [V]. `brandaro_callbacks.assigned_va` exists (table
is empty), and `ops_inbox_*` has a recipients table (empty). Nothing lets a human
claim an inbound conversation.

## Notification on inbound
- Brandaro: `brandaro-handle-inbound` classifies intent and routes to a "VA
  queue" — which is a DB row, not an alert [V]. No push, Slack, or email fires.
- GasMask missed calls: an **SMS to the caller**, not to staff [V].
- No Slack integration in any inbound path [V].
- Net: **nobody is notified when an inbound arrives.**

## SLA / time-to-first-response
Not measured anywhere [V]. No `first_response_at`, no SLA column, no query.

## Verdict
UNIFIED INBOX: **PARTIAL** — one real page over one of at least six inbound
stores, hard-capped at 200 rows, with no assignment, no notification and no SLA.
The highest-value fix in this audit is not building a new inbox; it is widening
`useUnifiedInbox` to union `dc_call_logs` + `brandaro_inbound_messages` +
`voicemails` and putting a notification on arrival.
