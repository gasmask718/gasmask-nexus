# Pass B addendum — clean-volume re-order + Mode 2 redundancy review
Date: 2026-07-31. All figures verified live against the database and Twilio.

---

## 1. Playboxxx quarantine — DONE

| Action | Result |
|---|---|
| Messaging Service `MG0bad9ddd1c76835ba9d4541ea5444a14` | `inbound_request_url` cleared, `use_inbound_webhook_on_number=true` [V] |
| Number `+19292623850` webhooks | `sms_url`, `sms_fallback_url`, `voice_url`, `sms_application_sid` all cleared [V] |
| Emergency address | unregistered (required before transfer) [V] |
| Isolated subaccount | created: `AC9732af1ab1b4aea957820eb83e03cef9` — "QUARANTINE - Playboxxx (no messaging, do not wire)" |
| Transfer | number now lives on that subaccount; parent-account tooling can no longer see or re-wire it [V] |
| `dc_phone_numbers` | `is_active=false`, friendly_name marked QUARANTINED |

**Intent evidence:** 1 historic SMS, 6 calls, row already deactivated and superseded by
`+19298225712`. No messaging product exists behind it.

---

## 2. Alert path — CONFIRMED LIVE, no further config needed

- Test SMS sent to GasMask `+19298225712` (`SM037840ea…`) → **delivered**, and landed in
  `communication_logs` as `direction=inbound, channel=sms, sender +18776818621`,
  within seconds. Inbound threading works.
- **The health alert fallback secrets did fire.** Two real alert texts were delivered to
  `ADMIN_ALERT_PHONE` today with no Slack webhook configured:
  - 15:00:54Z — "2 new failures (2 failing total)" (the `+18883022514` foreign-project pair)
  - 17:20:22Z — "2 new failures (4 failing total)" (`bland-call-webhook` 502, feature prober 502)
  Both `delivered`, no error code. `comms_health_alerts` holds the matching dedupe rows.
- Current monitor run: **160 checks, 2 fail, 61 warn** — down from the 88 open failures in
  Pass D. `alerted=0` on this run is correct: the 6h dedupe window is still open for both.

**Remaining 2 failures, both the same number:** `+18883022514` voice and SMS still point at
foreign project `clrgkreqqgmycrskcmwq`. That is now the single highest-value open item.

---

## 3. P0 GATE-NOW re-ordered on CLEAN volume

Contamination was worse than assumed. 90-day windows, health probes excluded:

| Path | Raw rows | Clean rows | Contamination |
|---|---|---|---|
| `bland_call_logs` (bland-start-call) | 3,549 | **8** | 99.8% |
| `dc_call_logs` (dc-outbound / inbound) | 81 | **70** | 14% |
| `communication_logs` channel=sms | 1,430 | **883** | 38% |
| `outreach_sms` | 0 | 0 | — |

Clean SMS is ~110x the volume of clean Bland calling. The ordering flips:

### Re-ordered P0
| Rank | Path / fix | Clean volume | Why here |
|---|---|---|---|
| 1 | **SMS egress via `communication_logs`** — suppression + actor gating on the 93 dispatchers that bypass `isSuppressed()` | 883 | Highest real traffic in the estate by an order of magnitude; also the compliance surface |
| 2 | **Inbound SMS handlers** (`gasmask-sms-inbound`, `twilio-sms-webhook`, `sms-inbound-webhook`) | 883 paired inbound | Same volume, and now proven working end-to-end |
| 3 | **Fix `+18883022514`** — voice + SMS off the foreign project | n/a | Only remaining `fail` in the monitor; traffic leaves the estate |
| 4 | **`dc_call_logs` voice paths** (`dc-inbound-call`, `twilio-inbound-call`, `dc-outbound-call`) | 70 | Real but small; top_tier 20, gasmask 9, brandaro 5 |
| 5 | **`bland-start-call` / Bland webhooks** | 8 | *Demoted from #1.* Its GATE-NOW status was entirely an artifact of 3,541 probe rows with `agent_type=null` |

**Split change: 31/44 → 30/45.** `bland-start-call` is the mover; everything else holds.
Nothing else in the original GATE-NOW list was carried by contaminated volume.

---

## 4. Mode 2 remediation — what is now redundant

Corrected reach: **49 files** consume `useCall()` / `CallProvider`, not the 13 that a
`useVoiceDevice`/`VoiceDeviceProvider` grep finds. `CallProvider` is mounted globally in
`App.tsx`, so every hub already has browser calling.

Struck from the plan as already-satisfied:
- ~~"Roll VoiceDeviceProvider out to GasMask store profile"~~ — reached via `useCall()`.
- ~~"Roll out to CRM contact profiles / Brandaro / delivery / VA hub"~~ — same.
- ~~"Per-hub Device mounting work"~~ — a global provider makes per-hub mounting a no-op.
- ~~"Phased Mode 2 rollout schedule"~~ — there is no phase left to schedule.

Still real (not reach problems):
- Per-brand caller-ID selection at dial time (argument-driven today, not identity-driven).
- Role gating on send/dial at the function boundary — unchanged by reach.
- `TEST_MODE` on the outbound dial path.

No further Mode 2 rollout work scheduled. `_shared/transport.ts` untouched.
