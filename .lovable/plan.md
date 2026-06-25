# System Audit — June 25, 2026
Scope: Auth & Access Control · Communications (Twilio/SMS/Voice) · CRM / Stores / Territory
Lenses: Missing pieces · Bugs & broken flows · Security & RLS gaps · UX gaps

Legend: ✅ working · ⚠️ partial / risky · ❌ broken or missing

---

## 1. Auth & Access Control

### What exists
- `src/pages/Auth.tsx` — email/password + Google OAuth, "Forgot password?" link, redirect-by-role via `getRoleRedirectPath`.
- `src/pages/ForgotPassword.tsx` → `resetPasswordForEmail` → `/reset-password`.
- `src/pages/ResetPassword.tsx` — `PASSWORD_RECOVERY` listener → `updateUser` → sign out.
- `src/pages/PendingApproval.tsx` — landing for unprivileged accounts.
- `src/config/osNavigation.ts` line 783 — `pending` → `/pending-approval`.
- Migration `20260624153002` — adds `'pending'` to `app_role`, `handle_new_user` defaults new profiles to `pending`.
- Roles in DB: 22 enum values incl. `admin, owner, ambassador, driver, biker, wholesaler, csr, pending, …`. `user_roles` table has RLS with admin-only writes ✅.

### Findings
| # | Sev | Area | Finding |
|---|---|---|---|
| A1 | ⚠️ Bug | Sign-up | `Auth.tsx` toast says *"Account created! You can now sign in."* — misleading. With email confirmation on, the user must confirm first; with the `pending` role, they cannot access anything. Should say "Check your email to confirm, then wait for admin approval." |
| A2 | ⚠️ Bug | Sign-up redirect | `handleSignUp` uses `emailRedirectTo: ${origin}/`. The redirect dumps confirmed users on `/`, which then bounces through role-routing. A `pending` user hits `/pending-approval` correctly only because of `osNavigation` — verify the path; users without a profile row briefly land on `/`. |
| A3 | ❌ Missing | Profile/role split | `profiles.role` is being set by `handle_new_user`, but the project's Core rule says roles live only in `user_roles`. New `pending` sign-ups are NOT inserted into `user_roles` — only `profiles.role`. Any `has_role()` check returns false → user is invisible to all RLS that depends on `user_roles`. |
| A4 | ⚠️ Missing | Admin promotion UI | No surfaced screen to list pending users and promote them to a real role. `useUserRolesAdmin` exists but there's no `/admin/pending-users` route. Pending users sit in limbo forever. |
| A5 | ❌ Security | Leaked-password protection | Scanner flag `SUPA_auth_leaked_password_protection` — HIBP check OFF. Enable via `configure_auth`. |
| A6 | ❌ Security | RLS errors from scanner | `SUPA_policy_exists_rls_disabled` = **error** level. At least one table has policies defined while RLS is disabled (data is fully exposed). Needs immediate `ENABLE ROW LEVEL SECURITY`. |
| A7 | ⚠️ Security | SECURITY DEFINER exposure | Multiple definer functions are EXECUTE-able by `anon`/`authenticated`. Audit and `REVOKE EXECUTE … FROM PUBLIC, authenticated` on anything that isn't intended to be callable. |
| A8 | ⚠️ Security | Mutable `search_path` | Several functions lack `SET search_path = public`. Search-path hijack risk. |
| A9 | ⚠️ UX | Reset-password page | Forces sign-out after update — good. But there is no "session expired / link invalid" branch shown; broken/expired links land on a blank state. |
| A10 | ⚠️ Bug | Forgot password — silent leak | Always toasts success even for unknown emails (Supabase default) — fine for privacy, but no UX hint when a real typo happens. Acceptable; document the choice. |
| A11 | ⚠️ UX | No "resend confirmation" path on sign-in for unconfirmed users. |
| A12 | ⚠️ Security | Hard-coded `DEV_ONLY_EMAILS = ['dev@gmail.com']` in `Auth.tsx`. Magic-string privileged routing — move to a flag or `user_roles`. |

---

## 2. Communications Stack (Twilio / SMS / Voice)

### What exists
- ~150+ edge functions covering SMS, voice, AI calls, webhooks, dialer, recordings, transcripts.
- `send-sms` — robust: A2P 10DLC guard, toll-free fallback `+18776818621`, API-key + auth-token candidates, AC-SID validation.
- `comms-health-monitor`, `check-twilio-health`, `system-health`, `voice-pipeline-audit`, `validate-twilio-credentials`.
- `/admin/twilio-test` console.
- `CommunicationLogModal` with `entityPhone` — store profile composer ✅ (A5.2 closed).
- `StoreDetail.tsx` line 693 passes `store.phone || store.alt_phone`.
- `twilio-sms-webhook`, `sms-inbound-webhook`, `twilio-status-webhook` registered.
- `communication_logs` RLS enabled.

### Findings
| # | Sev | Area | Finding |
|---|---|---|---|
| C1 | ⚠️ Bug | Modal mirror | Mirror insert into `communication_logs` uses field `summary: 'Manual SMS from store profile'` but the `CommunicationTimelineCRM` may sort by `created_at` only. Confirm the channel/direction filters in the timeline component pick this up; otherwise messages won't surface immediately. |
| C2 | ⚠️ Bug | Toast on partial success | `wantsLiveSend` checks `success !== false && status !== 'blocked'`. Twilio returns 200 with various error codes (queued / undelivered) that need status callbacks. Surface the Twilio `error_code` from `send-sms` so users know if the message was deferred. |
| C3 | ❌ Missing | No outbound throttling / dedupe | The `idempotency_key` is set but no DB-side unique constraint enforces it. Double-clicks can double-send. Add `UNIQUE (idempotency_key)` on `communication_logs`. |
| C4 | ⚠️ Security | RLS policy sprawl | `communication_logs` has **9 overlapping policies** (admins, CSR, ambassadors, business owners, generic "authenticated can insert"). The "Authenticated users can create logs" is permissive — any logged-in user can insert any row, bypassing per-store scoping. Consolidate and tighten. |
| C5 | ⚠️ Risk | Provider creds in env vs connector | `send-sms` reads `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` directly, but the project has a Twilio **connector** available. Decide one path; mixing both leads to silent failovers and inconsistent SIDs across functions. |
| C6 | ⚠️ Risk | SMS Pumping Protection / Geo Permissions — not confirmed enabled in Twilio console. Required before production traffic. |
| C7 | ❌ Missing | No surfaced "delivery status" badge per message — status webhook writes `twilio_sms_status` events but they aren't reflected on the timeline row. |
| C8 | ⚠️ Bug | `TWILIO_PHONE_NUMBER` env can be silently overridden to toll-free fallback. Operators won't know why their configured number was ignored — log a warning to a visible health surface (currently only `console.log`). |
| C9 | ⚠️ Duplication | Many near-identical functions: `bland-send-sms`, `relay-sms`, `ambassador-send-sms`, `bulk-sms-processor`, `messaging-send-worker`, `send-operator-sms`, `send-approval-sms`, `send-biztext-sms`, `send-invoice-sms`, `brandaro-sms-dispatch`. Maintenance hazard — consolidate around `send-sms` with `purpose`/`template` params. |
| C10 | ⚠️ UX | No "SMS opt-out / STOP" handling visible on store profile. Required for TCPA compliance — flag opted-out numbers in the composer and disable the toggle. |
| C11 | ⚠️ Voice | Many call functions (`call-ai-*`, `twilio-bridge*`, `brandaro-call-twiml`) — no central health dashboard showing which webhooks are wired vs. orphaned. `discover-twiml-apps` exists but isn't surfaced. |

---

## 3. CRM / Stores / Territory

### What exists
- `Stores`, `StoreDetail`, `CRMCustomerDetail`, `CRMContactDetail`, `MasterOpportunities`, `OpportunityRadar`.
- Territory hub: `TerritoryOverview`, `VisitConsole`, `ScoutConsole`, `CallConsole`, `TerritoryCandidates`, `TerritoryGapIntelligence`, `PromotionsPending/History`, `TerritoryIngestion`, `TerritoryPlaybooks`, AI permissions screens.
- Ingestion: `ingest-google-places`, `ingest-yelp`, `ingest-openstreetmap`, `ingestion-enrich-phones`, `batch-geocode-stores`, `batch-phone-detection`.

### Findings
| # | Sev | Area | Finding |
|---|---|---|---|
| T1 | ❌ Bug (per memory) | Prospect pages misuse | `mem://territory/prospect-pages-promote-not-dispatch` — VisitConsole/ScoutConsole/TerritoryCandidates/GapIntelligence are for pre-CRM addresses. Confirm they call `request_store_promotion` and NOT `RouteAssignmentDialog`. Needs verification pass. |
| T2 | ⚠️ Backlog | Merge engine rename gap | `mem://governance/merge-engine-rename-gap-and-rename-pass-scope` — Phase E.5 is log-only. ~2,400 stores still hold pre-merge names. Pending smart-rename pass. |
| T3 | ⚠️ Backlog | Merge engine future fixes | `mem://governance/merge-engine-future-fixes` — address-keyed override matching + survivor scoring rule (Bayridge mis-merge root cause). |
| T4 | ⚠️ Data | Post-dedup orphan classification | `mem://governance/merge-dedup-skipped-orphans` — orphan counts must exclude dedup-skipped rows; verify any "orphan cleanup" jobs aren't hard-deleting them. |
| T5 | ⚠️ UX | Store profile completeness | Composer requires `store.phone || store.alt_phone`. Stores without either silently get the composer hidden — surface "Add a phone number to enable SMS" rather than no UI at all. |
| T6 | ⚠️ Security | `stores` policies not audited here, but `communication_logs` cross-references `store_id` without policy joining to store ownership in the permissive insert (see C4). |
| T7 | ⚠️ Missing | No "communication preferences" record per store (SMS / call / email opt-in, quiet hours). Required for the cadence rules in `mem://crm/relationship-tier-and-cadence-standard`. |
| T8 | ⚠️ Bug | `CommunicationLogModal` `onSuccess` callback fires only on the live-SMS path early-return; the manual `communication_events` insert path also calls it — confirm timeline refreshes for both. |
| T9 | ❌ Missing | No admin view of `pending` users tied to CRM (e.g. store contacts who self-signed up). They sit in `auth.users` with `pending` role and no link back to a store record. |
| T10 | ⚠️ UX | Territory ingestion pages need a visible "last enrichment run" status — `ingestion-enrich-phones` runs sequentially but no progress meter is surfaced. |

---

## 4. Cross-cutting Security Findings (from scanner)

| ID | Level | Action |
|---|---|---|
| `SUPA_policy_exists_rls_disabled` | **error** | Find tables with policies + RLS disabled, `ALTER TABLE … ENABLE ROW LEVEL SECURITY`. |
| `SUPA_anon_security_definer_function_executable` | warn | Audit + `REVOKE EXECUTE … FROM anon`. |
| `SUPA_authenticated_security_definer_function_executable` | warn | Same for `authenticated` where not intended. |
| `SUPA_function_search_path_mutable` | warn | Add `SET search_path = public` to flagged functions. |
| `SUPA_materialized_view_in_api` | warn | Revoke API access or move out of `public`. |
| `SUPA_public_bucket_allows_listing` | warn | Tighten storage SELECT policies. |
| `SUPA_auth_leaked_password_protection` | warn | Enable HIBP via `configure_auth`. |

---

## Recommended Fix Order

1. **Critical (this week)**
   - A6 — find RLS-disabled tables with policies and enable RLS.
   - A3 — make `handle_new_user` also insert `user_roles (user_id, 'pending')`, or document why `profiles.role` is the source of truth alongside the Core rule.
   - C4 — drop the permissive `"Authenticated users can create logs"` policy on `communication_logs` and replace with store-scoped insert.
   - C3 — add `UNIQUE (idempotency_key)` on `communication_logs` to stop double-sends.

2. **High (next sprint)**
   - A4 / T9 — build `/admin/pending-users` promotion screen.
   - A5 — enable HIBP leaked-password protection.
   - C7 — wire status-webhook updates back to the timeline row.
   - C10 — surface STOP/opt-out state in the composer.
   - T1 — verify prospect-page CTAs match the promote-not-dispatch rule.

3. **Medium**
   - A1, A11, A12 — sign-up copy, resend-confirmation, remove hard-coded dev emails.
   - C9 — consolidate the SMS-sending function zoo.
   - T7 — per-store communication preferences table.
   - A7/A8 — function-level REVOKE + search_path hardening sweep.

4. **Backlog**
   - T2, T3 — merge engine rename + override-matching upgrades.

---

Tell me which section to drill into and I'll switch to build mode to start fixing.