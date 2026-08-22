# Final Five Person-Facing Conversion — 2026-08-22

Converts the last five human-triggered person-facing SMS sites. None fire
unattended (that is why they were last); all now route through `send-sms`.
Double-reply check: none of the five pair a REST send with a TwiML `<Message>`
reply — `brandaro-handle-inbound` was the only dual-sender in the project.

| Function / site | Audience | Class | Notes |
|---|---|---|---|
| `field-portal-comms` — worker → store SMS | store owners | `conversational` | skipCooldown (human-paced per tap; 60/day cap stays). Suppressed → `communication_logs` row `outcome = 'field_sms_suppressed'`, `delivery_status = 'blocked'`, and a 200 `{ ok: false, suppressed: true, reason }` the portal surfaces as "call instead" |
| `send-approval-sms` — UT staff/venue approval notice | approved applicants | `transactional` | skipCooldown (one approval = one notice). Suppressed → 403 `{ suppressed: true }`; caller treats SMS as non-blocking, so the approval itself never fails |
| `brandaro-closer-action` — `sms` action | lead at closer desk | `conversational` | skipCooldown. Blocked → `communication_logs` status `blocked` + thrown error the desk UI toasts |
| `brandaro-closer-action` — `payment_link` action | lead post-quote | `transactional` | skipCooldown. Same blocked handling |
| `brandaro-send-demo` — demo invite | cold-ish leads | **`campaign`** | full suppression + campaign cooldown. Blocked → `brandaro_message_log` `send_status = 'blocked'` and **never queued into `brandaro_job_failures`** (retrying a suppression block is wrong) |
| `cb-dispatch-engine` — partner offer | coach-bus partners | `workforce` | skipCooldown. tt-* pattern: suppressed partner → `cb_communication_logs` status `suppressed`, dispatch row status `suppressed`, and `suppressed_partners` (id, name, phone, reason) in the response payload |
| `cb-dispatch-engine` — customer offer + auto-offer | customer post-quote | `transactional` | skipCooldown; suppressed → `cb_communication_logs` status `suppressed` |

## Sender parity

- `brandaro-closer-action` previously sent with `MessagingServiceSid` and no
  `From`. `send-sms` applies the same global `TWILIO_MESSAGING_SERVICE_SID`
  automatically, so the presented sender is unchanged with no override.
  (Reminder: the Messaging-Service-level inbound webhook override that drops
  inbound SMS — the defect fixed on the UT number — is still the open item;
  outbound-only conversion does not touch it.)
- `field-portal-comms`: `amb.twilio_number || BUSINESS_NUMBER` via `from`.
- `brandaro-send-demo`: `BRANDARO_TWILIO_NUMBER || TWILIO_FROM_NUMBER`.
- `cb-dispatch-engine`: `TWILIO_PHONE_NUMBER || +18484004179` (unchanged).
- `send-approval-sms`: `TWILIO_FROM_NUMBER || TWILIO_PHONE_NUMBER` (unchanged).

## brandaro-send-demo is campaign, and why

Three triggers hit the same function: the SendDemoModal / LeadDatabasePage UIs
(human picks the recipient), `brandaro-generate-demo` auto-send (unattended),
and `brandaro-retry-jobs` (unattended). Because the unattended path is cold
outreach, the function takes the campaign class — full `isSuppressed` +
`legalStopBlocked` + campaign cooldown, no skipCooldown. The pre-existing
`isSuppressed` pre-check stays (it writes the brandaro-side blocked row);
send-sms remains the single gate.

## What remains after this

Only the quiet pair (`brandaro-retell-webhook`, `brandaro-autonomous-executor`
— dead/untriggered paths) plus internal-only senders. The person-facing
conversion workstream is done as a workstream, not just as a list. Open items
move to `docs/comms/OPEN-WORK-2026-08-20.md`: the three Messaging Services
dropping inbound SMS since June, and per-program consent (deferred).
