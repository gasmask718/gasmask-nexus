# Inbound Auto-Reply Suppression + dd-* Conversion — 2026-08-22

Converts the two live inbound auto-reply senders and the Dynasty Direct trio.
Suppression bypass count: **~17 → ~13 person-facing send sites** (the two
auto-replies were the unattended, highest-risk pair).

## The suppression-eats-the-reply question

On dispatch, a blocked send meant a driver didn't hear about a job. On
inbound auto-reply, the person just rang or texted us and is expecting
something back. Decisions taken:

1. **A legal STOP is honoured even when the person just contacted us.**
   Honouring the opt-out is the point; we do not text someone who asked not
   to be texted.
2. **The contact is never lost.** Both handlers log the blocked outcome to a
   queryable table (below), so a human can return the call by **voice** — an
   SMS STOP does not block calls, and a voice callback is the honest answer
   to "they texted in but we can't text back."
3. **Re-consent is NOT inferred from an inbound text.** Whether an inbound
   message from a previously-opted-out number legally re-opens SMS contact is
   a **legal question, not a technical one** — flagged for counsel, not
   answered in code. Until decided, the code takes the conservative answer:
   gate stays closed.

## gasmask-missed-call-handler (conversational)

- Direct `Messages.json` POST → `sendSms({ sendClass: "conversational" })`.
- Idempotency: `gasmask-missed-${CallSid}` (hour-bucket fallback).
- Sender parity: texts back from the number the caller dialled.
- Local opt-out pre-check **removed** — send-sms is the single gate, so there
  is one gate and one audit trail (previously two different checks could
  disagree).
- Suppressed outcome → `communication_logs` row:
  `outcome = 'missed_call_recovery_suppressed'`,
  `delivery_status = 'blocked'`, summary notes the caller is reachable by
  voice. Queryable the same way as the dispatch-suppression rows.

## brandaro-handle-inbound (conversational)

- `sendAutoReply` direct POST → `sendSms({ sendClass: "conversational" })`.
- **TwiML `<Message>` reply removed.** The function previously replied both
  via the REST API and via the returned TwiML — the TwiML path bypassed every
  gate. Response is now always an empty `<Response/>`; all egress routes
  through send-sms.
- Idempotency: `brandaro-ar-${MessageSid}` (content-hash fallback on the
  manual JSON path).
- Sender parity: replies from the brandaro number the lead actually texted
  (`sigParams.To`), falling back to `TWILIO_PHONE_NUMBER` (previous helper's
  sender).
- Suppressed outcome → `brandaro_message_log` row with
  `send_status = 'suppressed'`; the inbound message still lands in
  `brandaro_inbound_messages` (with `ai_response` as the unsent draft and
  `ai_auto_responded = false`) so a VA sees the lead and can call back.

## dd-* trio

- **dd-pay-partner** → `sendSms({ sendClass: "transactional" })`,
  idempotency `dd-payout-sms-${payout_id}`, `skipCooldown: true` (one payout =
  one notice). STOP is absolute even here: the money still moves, the notice
  is blocked, and the blocked outcome is written to `admin_notifications_log`
  (`status = 'blocked'`) so support knows the partner wasn't texted and that
  the email fallback carried it.
- **dd-notify-question** → `sendTwilioSms({ suppressionClass: "internal" })`.
  Operator alert to a staff-owned handset; logged to
  `admin_notifications_log` by the helper. (Function currently has no
  repo-side caller — converted so it's correct if it ever runs.)
- **dd-whatsapp-notify** — keeps its direct Twilio call: send-sms and
  twilioSend are SMS-shaped and would mangle the `whatsapp:` prefix. Now
  carries the rest of the standard: legal-STOP gate (pre-existing), a
  deterministic idempotency key (`dd-wa-{wholesaler}-{day}-{content hash}`)
  checked against `outbound_messages` before sending, and an
  `outbound_messages` audit row for every outcome — sent, failed, blocked.

## Where to query suppressed outcomes

| Path | Table | Marker |
|---|---|---|
| GasMask missed-call recovery | `communication_logs` | `outcome = 'missed_call_recovery_suppressed'` |
| Brandaro inbound auto-reply | `brandaro_message_log` | `send_status = 'suppressed'` |
| DD payout notice | `admin_notifications_log` | `status = 'blocked'`, event `sms:transactional:dd-pay-partner` |
| DD WhatsApp | `outbound_messages` | `status = 'blocked'`, `error_code = 'legal_stop'` |
| Everything via send-sms | `outbound_messages` | `status = 'blocked'` |

## Remaining person-facing direct-POST groups (next candidates)

`supplier-send` / `supplier-reply-webhook`, `field-portal-comms`,
`nightlife-notify`, `send-approval-sms`, `brandaro-closer-action`,
`brandaro-send-demo`, `brandaro-provision-receptionist`, `cb-dispatch-engine`.
`brandaro-retell-webhook` and `brandaro-autonomous-executor` remain
dead/untriggered paths.
