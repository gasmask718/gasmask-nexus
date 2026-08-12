# Dynasty Capital — Final Integration & Inbound Lender Webhook Proof
Date: 2026-08-12 · Environment: live project `qalaaroashbggynpvqct` · Mode: build + test on live data (QA fixtures only)

## 1. What was built

### Generic inbound lender webhook — `supabase/functions/lender-webhook`
Provider-neutral endpoint. It contains **no** automation engine of its own; it authenticates,
validates and normalizes an external event and then feeds the **existing** pipeline:

```text
lender POST
  -> HMAC-SHA256 auth (timestamp + raw body)
  -> schema validation
  -> DB-enforced idempotency (unique provider+event_id)
  -> application matching (internal id, then external ref)
  -> QA-fixture boundary check
  -> public.record_application_status()   [atomic, replay-guarded]
       -> funding_applications
       -> funding_application_status_history
  -> client_status_updates (client-safe copy only)
  -> get_capital_plan -> Dynasty Capital HUD + Client Portal
```

Endpoint: `POST /functions/v1/lender-webhook`
Headers: `x-dynasty-provider`, `x-dynasty-timestamp` (unix seconds), `x-dynasty-signature: sha256=<hex>`
Signature base string: `` `${timestamp}.${rawBody}` `` — HMAC-SHA256, constant-time compared.
`verify_jwt` is intentionally false: lenders cannot hold Supabase JWTs, so the HMAC is the auth boundary.

### Supporting schema
| Table | Purpose | Exposure |
|---|---|---|
| `lender_webhook_providers` | registry: provider, secret **name**, clock tolerance, active, is_qa_fixture | staff read, service_role write, **anon revoked** |
| `funding_application_external_refs` | provider + external id -> application id | staff read, service_role write, **anon revoked** |
| `funding_lender_webhook_events` | every inbound event: raw payload, hash, signature validity, outcome | staff-only, **anon revoked** |
| `qa_probe_results` | captured output of QA probes (evidence) | staff-only |

Secret values are never stored in the database — only the *name* of the environment variable.

### Conflict-aware idempotency (`public.record_application_status`)
Returns `{applied:false, reason:'duplicate_event'}` for an exact replay and
`{applied:false, conflict:true, reason:'conflicting_event'}` when the same `event_id`
arrives carrying a different status/amount. The first record stays authoritative.

## 2. Test results — 14/14 webhook + 4/4 RPC

### RPC idempotency (direct, application `0c2619ad…`, QA Fixture B)
| Probe | Result | Verdict |
|---|---|---|
| IDEM-A first event `QA-EVENT-001` Approved 35000 | `applied:true`, Preparing -> Approved | PASS |
| IDEM-B exact replay | `applied:false, reason:duplicate_event` | PASS |
| IDEM-C same event id, Denied/0 | `applied:false, conflict:true, reason:conflicting_event` | PASS |
| IDEM-D new event `QA-EVENT-002` Under Review | `applied:true` | PASS |

History rows for `QA-EVENT-001` after three attempts: **1**.

### Webhook suite (application `c43db29d…`, QA Fixture A, provider `qa_fixture_provider`)
| Test | Expected | Got | Verdict |
|---|---|---|---|
| W-AUTH-1 missing signature headers | 401 | 401 | PASS |
| W-AUTH-2 invalid signature | 401 | 401 | PASS |
| W-AUTH-3 timestamp outside tolerance | 401 | 401 | PASS |
| W-AUTH-4 unknown provider | 401 | 401 | PASS |
| W-VAL-1 malformed JSON | 400 | 400 | PASS |
| W-VAL-2 missing `event_id` | 400 | 400 | PASS |
| W-VAL-3 unsupported status `TELEPORTED` | 400 | 400 (no mutation) | PASS |
| W-MATCH-1 unmatched external id | 202 NEEDS_HUMAN_REVIEW | 202, nothing modified | PASS |
| W-QA-1 non-fixture provider targeting QA client | 409 | 409 `qa_isolation_violation` | PASS |
| W-FLOW-1 valid event -> Under Review | 200 processed | 200, matched_by `external_ref` | PASS |
| W-IDEM-1 exact replay | 200 duplicate | 200 `idempotent:true` | PASS |
| W-IDEM-2 same event id, different payload | 409 | 409 conflict, authoritative status preserved | PASS |
| W-FLOW-2 Approved + $42,000 + decision date | 200 processed | 200 | PASS |
| W-CONC-1 five parallel identical events | 1 processed / 4 duplicate | 1 processed / 4 duplicate | PASS |

Post-run database state (application `c43db29d…`): `status=Funded`, `approved_amount=42000`,
`decision_date=2026-08-12`; exactly one `lender_webhook` history row per applied status
(Under Review, Approved, Funded); webhook event log: 3 processed, 2 rejected, 1 needs_human_review;
3 client-portal updates created.

### Security probes
Unauthenticated (anon) REST reads of `funding_lender_webhook_events`,
`lender_webhook_providers` and `funding_application_external_refs` now fail on grants
(anon privileges revoked), matching the existing `funding_applications` posture.
The client portal reads status history with an explicit column list that excludes
`metadata`, and the webhook only ever writes normalized, client-safe fields into
`funding_application_status_history` and `client_status_updates` — raw lender payloads
stay in the staff-only event log.

## 3. Honest state

| Area | State |
|---|---|
| Webhook infrastructure | **PROVEN** on live data |
| Idempotency + conflict detection (RPC and HTTP layers) | **PROVEN** |
| Concurrency (parallel duplicate delivery) | **PROVEN** — exactly-once |
| Signature/timestamp/provider authentication | **PROVEN** |
| Status propagation to applications, history and portal feed | **PROVEN** |
| QA fixture / production isolation | **PROVEN** |
| Anon exposure of webhook internals | **CLOSED** |
| `get_capital_plan` aggregation | verified previously via authenticated REST; not re-runnable from a service context (it rejects callers without `auth.uid()`), and its inputs (`funding_applications.status/approved_amount`) are confirmed correct |
| Real lender integration | **UNPROVEN BY DESIGN** — no authorized lender exists. Onboarding one requires only a row in `lender_webhook_providers` plus its signing secret; no code change. |

## 4. Onboarding a real lender (no code change)
1. Store the lender's signing secret as an environment secret, e.g. `LENDER_<NAME>_WEBHOOK_SECRET`.
2. `INSERT INTO lender_webhook_providers(provider, display_name, signing_secret_name, tolerance_seconds, active, is_qa_fixture) VALUES (…, false);`
3. Map each submitted application: `INSERT INTO funding_application_external_refs(application_id, provider, external_id) …`
4. Give the lender the endpoint URL and the header/signature contract in section 1.

## 5. QA fixtures in use
- Clients: `QA FIXTURE A LLC` (`e4657746…`), `QA FIXTURE B LLC` (`7945aa76…`) — both `is_qa_fixture=true`
- Applications: `c43db29d…` (A, webhook target), `0c2619ad…` (B, RPC probes)
- Providers: `qa_fixture_provider` (fixture), `qa_isolation_probe` (non-fixture, isolation test only)
- Test signing key stored as `QA_LENDER_WEBHOOK_SECRET`; it authorizes only fixture providers, which are blocked from touching non-fixture clients.
