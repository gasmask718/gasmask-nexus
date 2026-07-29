## UT-025 — Outreach Compliance (plan only, nothing applied)

### Fix 1 — The swallowed block (highest priority)
File: `src/hooks/useUTPartnerLeads.ts`

`sendSmsTemplate` (~:298) and `sendOnboardingLink` (~:369) both discard the edge-function response. Rewrite both mutation bodies to:

1. `const { data, error } = await supabase.functions.invoke('send-sms', {...})` — throw on `error`.
2. Treat `data?.success === false` as a **block**, not a send:
   - insert `ut_outreach_logs` with `outcome: 'sms_blocked'`, `notes: data.reason ?? 'blocked'`, `template_name` still recorded, `channel: 'sms'`
   - **no** `sms_sent` row, **no** `sms_count` increment, **no** `last_contacted_at`, **no** `last_sms_template` update
   - for `sendOnboardingLink`: also skip the `ut_partner_onboarding` → `status:'sent'`/`sent_at` update and skip `onboarding_link_sent_at`
   - return `{ success: false, reason, templateLabel }` so the UI renders a blocked state
3. Only on `data?.success === true` keep today's logging + counter updates.
4. `onSuccess` branches on `result.success`: success → existing green toast; blocked → `toast.error('🚫 Blocked: <reason>')`. No silent success path remains (`?? true` default is removed — an absent/undefined `success` is treated as failure).

### Fix 2 — Unified suppression check
File: `supabase/functions/_shared/dnc.ts` — **pure addition**. `isOnDNC`, `normalizeE164`, `CANONICAL_DISPOSITIONS`, `DISPOSITION_ALIASES`, `canonicalizeDisposition` untouched, so GasMask / `dd-` / `tt-` / `dc-*` behaviour is unchanged.

New export:

```text
isSuppressed(supabase, phone)
  -> { blocked: boolean; reason?: string; source?: 'dnc_list' | 'opt_out_events' }
```

- normalises with the existing `normalizeE164`
- checks `dnc_list` (same OR-query shape as `isOnDNC`: `phone_e164`, `phone_number`, raw)
- checks `opt_out_events` by digits-only `phone_number` (the format that table actually stores, per `send-sms`)
- returns the first hit with its `source`
- **fails CLOSED**: any thrown lookup error → `{ blocked: true, reason: 'suppression_lookup_failed' }`

Wiring:

- `supabase/functions/send-sms/index.ts` (~246-266): replace the inline `opt_out_events` query with `isSuppressed`. Response shape stays `{ success:false, status:'blocked', reason }` (reason now carries the DNC reason when the hit came from `dnc_list`), and the `outbound_messages` row still logs `status:'blocked'` with the reason in `error_message`.
- `supabase/functions/twilio-outbound-call/index.ts`: no suppression check today. Add `isSuppressed` immediately after the `outbound_call_queue` lookup, gating on `item.phone_number` (that function takes `queue_item_id` + `business_id`, not a raw `to_number`), returning `{ success:false, status:'blocked', reason }` before any Twilio API call.

Out of scope, untouched: `dc-bland-dispatch`, `dc-outbound-call`, `ut-/dd-/tt-trigger-bland-campaign`, `dc-bland-webhook`, both `gasmask-dnc-*` functions.

### Fix 3 — STOP footer
File: `src/config/utScripts.ts` — append ` Reply STOP to opt out.` to the four first-contact templates: `intro_text`, `send_info_text`, `missed_you_text`, `owner_unavailable_text`. The three reply-context templates (`callback_text`, `interested_followup`, `onboarding_link_text`) are left alone as they only follow an established conversation.

Before/after example (`intro_text`):

```text
- ...No upfront cost — customers come to you. Want me to get you set up?
+ ...No upfront cost — customers come to you. Want me to get you set up? Reply STOP to opt out.
```

### Verification I will run and paste
- `git diff supabase/functions/_shared/dnc.ts` — additions only, `isOnDNC` body byte-identical
- `git diff --stat supabase/functions/gasmask-*` — empty
- Live test: call `send-sms` against a number seeded in `dnc_list` only → expect `status:'blocked'`; confirm no `sms_sent` row and `sms_count`/`last_contacted_at` unchanged on the lead
- Confirm `twilio-outbound-call` returns blocked for a suppressed queue item without hitting Twilio
- `tsgo` typecheck + build

### Note (not in scope, flagging)
`useUTAIDialer.ts` sends `to_number`/`agent_id` to `twilio-outbound-call`, which requires `queue_item_id`/`business_id` — that hook is already dead code (commented out in `UTOutreachCommand.tsx`) and would 400 if re-enabled. I will not change it here.
