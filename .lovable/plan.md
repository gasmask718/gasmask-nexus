
# Pre-Phase Verification Plan — T7a

## Findings (from read-only inspection, no code changed)

### 1. Canonical inbound handler → **`dc-inbound-call`**

```sql
SELECT webhook_url, count(*) FROM dc_phone_numbers
WHERE status='active' AND is_active=true GROUP BY webhook_url;
--  https://qalaaroashbggynpvqct.supabase.co/functions/v1/dc-inbound-call | 14
```

All 14 already-configured active rows point at the same URL: **`dc-inbound-call`**. That URL is the source of truth for Phase 3.

Handler triangulation:
- `supabase/functions/dc-inbound-call/index.ts` (138 lines) — table-driven, looks up `v_phone_directory` → `assigned_agent_id` → per-business `*_BLAND_INBOUND_NUMBER` env fallback → global `BLAND_INBOUND_NUMBER`. Verifies Twilio signature.
- `supabase/functions/twilio-inbound-call/index.ts` (138 lines) — **byte-identical duplicate** (same header comment "TWILIO INBOUND CALL HANDLER (also the dc-inbound-call handler)", same code). Not referenced by any active `dc_phone_numbers.webhook_url` row. Orphan / historical alias.
- `supabase/functions/brandaro-handle-inbound/index.ts` (353 lines) — different function entirely, Brandaro-specific inbound logic. Not referenced by any of the 14 active rows.

**Phase 3 canonical target: `dc-inbound-call`.** The `twilio-inbound-call` duplicate is out of scope for T7 but flagged as a cleanup candidate (once T7 lands and we're sure nothing external hits it).

### 2. `dc_phone_numbers` column audit

Existing columns (23): `id, phone_number, sid, friendly_name, webhook_url, status, is_ai_number, monthly_cost, purchased_at, created_at, business, twilio_sid, elevenlabs_phone_id, assigned_agent_id, assigned_agent_name, is_active, number_type, display_name, elevenlabs_agent_name, twilio_webhook_configured, twilio_webhook_configured_at, sms_webhook_url, assigned_va_id`.

**Missing (confirmed):** `deactivated_at`, `deactivation_reason`, `updated_at`.

→ Fold all three into the **Phase 1 migration** alongside the warming columns (single migration, not two).

### 3. Dual active-state columns confirmed

`status` and `is_active` are both present and (per T7 audit) disagreed on the 5 targets. **Phase 2 resurrection UPDATE must set both**: `status='active'` **AND** `is_active=true`. Logged for Phase 2 spec.

### 4. Secret names present in Lovable Cloud

- `TWILIO_ACCOUNT_SID` ✅
- `TWILIO_AUTH_TOKEN` ✅ (parent set — the one production voice paths use)
- `BRANDARO_TWILIO_*` also present but not used for this verify.

I cannot read values from the secret store — the `AC` vs `US` prefix check has to happen at runtime inside `t7a-verify-numbers`. That check is built in as the first gate below.

---

## t7a-verify-numbers — spec

**Path:** `supabase/functions/t7a-verify-numbers/index.ts`
**Auth:** JWT off; requires `x-bootstrap-token: <T4_BOOTSTRAP_TOKEN>` header (same protocol as `t4-bootstrap-devtest` / `public-site-admin-bootstrap`). Non-matching token → 403.
**Read-only:** only Twilio GETs. No writes anywhere, no DB mutations.

### Input
```json
{ "phone_numbers": ["+1XXXXXXXXXX", ... 5 numbers] }
```

### Runtime gate (before any Twilio call)
```
sid = Deno.env.get("TWILIO_ACCOUNT_SID")
if (!sid.startsWith("AC"))  → return 500 {
  error: "TWILIO_ACCOUNT_SID_PREFIX_INVALID",
  observed_prefix: sid.slice(0,2),
  message: "Supabase secret is not an Account SID (starts with US, not AC). STOP — fix secret before any Twilio work."
}
```

### Per number
1. `GET https://api.twilio.com/2010-04-01/Accounts/{AC_SID}/IncomingPhoneNumbers.json?PhoneNumber={number}` (Basic auth: `AC_SID:AUTH_TOKEN`)
   - Capture: `sid`, `account_sid` (ownership), `phone_number`, `friendly_name`, `voice_url`, `voice_method`, `voice_fallback_url`, `sms_url`, `sms_method`, `status_callback`, `capabilities` (voice/sms/mms), `date_created`, `date_updated`, `origin`, `emergency_status`.
   - `ownership_ok = (account_sid === TWILIO_ACCOUNT_SID)`.
   - If the query returns 0 rows → `owned: false, released_or_ported: true`.
2. `GET .../Calls.json?To={number}&Status=failed&StartTime>={now-30d}&PageSize=50`
   - Capture count, plus first 10 rows with `sid, from, status, to, start_time, duration, price, error_code`.
   - Any repeated `error_code` (e.g. 30003 = unreachable, 30005 = unknown destination, 21610 = STOP received, 32017 = carrier reject) is surfaced as `carrier_flag_candidates`.

### Output shape
```json
{
  "twilio_account_sid_prefix": "AC",
  "checked_at": "2026-07-08T…Z",
  "numbers": [
    {
      "phone_number": "+1…",
      "owned": true,
      "twilio_sid": "PN…",
      "friendly_name": "…",
      "voice_url": "https://…/dc-inbound-call",
      "voice_method": "POST",
      "sms_url": "…",
      "capabilities": { "voice": true, "sms": true, "mms": false },
      "date_created": "…",
      "failed_calls_30d": { "count": 0, "sample": [], "carrier_flag_candidates": [] }
    }, …
  ]
}
```

### Gate summary the reply will state per number
- `owned` (true/false — ownership_ok)
- `voice_url` matches canonical `dc-inbound-call`? (info only, Phase 3 will fix)
- Any carrier-reject pattern in last 30d? (yes/no)
- Any number not returned by IncomingPhoneNumbers → **excluded from Phase 2** and documented.

---

## Execution sequence (once you paste the 5 numbers)

1. Create `supabase/functions/t7a-verify-numbers/index.ts` (spec above).
2. `deploy_edge_functions(["t7a-verify-numbers"])`.
3. `curl_edge_functions POST /t7a-verify-numbers` with header `x-bootstrap-token: $T4_BOOTSTRAP_TOKEN` and body `{ "phone_numbers": [ … 5 … ] }`.
4. Paste the full JSON report into the reply, plus a plain-English per-number summary:
   - ownership OK / released
   - webhook currently points at: `<url>`
   - carrier-flag evidence: none / list
5. `delete_edge_functions(["t7a-verify-numbers"])` **and** `rm -rf supabase/functions/t7a-verify-numbers/`.
6. Confirm both deletions in the reply.

## Then — and only then — proceed conditions for Phases 1–4
Before Phase 1 runs, the reply must state:
- All 5 numbers `owned=true`, else the released ones are excluded and named.
- No carrier-flag pattern in last 30d (or list the flagged numbers and exclude).
- Canonical inbound handler = `dc-inbound-call` (confirmed above).
- `TWILIO_ACCOUNT_SID` starts with `AC` (verified live at runtime by the gate).

If any of those four fails, I stop and surface — no Phase 1 migration.

## Blocker before I can run this

**You didn't include the 5 target phone numbers in this message.** Paste them in E.164 (e.g. `+13055551234`) and I'll create the function, deploy, invoke, report, and delete in one turn.
