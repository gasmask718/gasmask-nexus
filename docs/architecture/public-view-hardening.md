# Public-facing view hardening — standing rule

`public.products_public` produced **three distinct security issues in one day**
(cost-column leak → security-definer view → full write grants to `anon`).
Every public-facing view is now covered by three independent layers.

## 1. Declared safe state (source of truth)

- **On the view itself** — `COMMENT ON VIEW public.products_public` spells out the
  purpose, forbidden columns, and exact required grants. Read it before changing the view.
- **Machine-readable** — `public.public_view_contracts`:
  | column | meaning |
  |---|---|
  | `view_name` | view in `public` |
  | `allowed_privileges` | exact privileges public roles may hold (`{SELECT}`) |
  | `public_roles` | roles the contract governs (`anon`, `authenticated`) |
  | `forbidden_columns` | columns that must never appear in the view |

Adding a new public-facing view? **Insert a row here in the same migration** and add
the view name to `VIEWS` in `scripts/check-public-view-grants.mjs`.

## 2. Continuous detection — `public-view-security-probe` (cron 113, daily 06:15 UTC)

For every contracted view it runs, with the **real anon key**:
`GET` (must succeed) and `PATCH name` / `PATCH status` / `POST` / `DELETE` (must all fail
with `42501 permission denied`). It then calls `public.assert_public_view_grants()`,
which flags `excess_privilege`, `missing_select`, `forbidden_column`, and `view_missing`.

Results land in `public.public_view_security_probes` and the
`public_view_security_probe` row of `public.health_checks` (visible on `/system-health`).
Any breach fires SMS/Slack immediately (6h dedupe) via
`SECURITY_ALERT_PHONE` → `ADMIN_ALERT_PHONE` → `DAVID_PHONE_NUMBER`.

## 3. Deploy gate — `scripts/check-public-view-grants.mjs`

Wired into `prebuild`, so `npm run build` runs it. Same anon probes, no service
credentials required. If any write succeeds, the script exits non-zero and the deploy
stops. Bypass only for offline local builds with `SKIP_VIEW_GRANT_CHECK=1`.

## Fixing a detected regression

```sql
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.<view> FROM anon, authenticated;
GRANT SELECT ON public.<view> TO anon, authenticated;
GRANT ALL ON public.<view> TO service_role;
```

Writes belong on the RLS-protected base table (`products_all`) or a service-role
edge function — never on the view.
