# Dynasty Partners — Schema Deployment Guide

The `partners` schema houses the entire Dynasty Partners platform: partner accounts, platforms, campaigns, AI personas, leads, ambassadors, outreach, tracking links, sales, commission splits, payouts, MRR, activity log, notifications, and add-ons.

It lives **inside** the existing Dynasty OS Supabase project (`qalaaroashbggynpvqct`) and does **not** modify the `public` schema or any existing tables.

---

## 1. Run the migration

The migration is auto-applied by Lovable. To re-run manually against any Supabase project:

1. Open Supabase Dashboard → **SQL Editor**.
2. Paste the contents of the latest `supabase/migrations/*partners*.sql` file.
3. Click **Run**.

The script is idempotent on the schema/seed inserts (`CREATE SCHEMA IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).

---

## 2. Expose the schema via PostgREST

By default Supabase only auto-generates the API for `public`. To make `partners.*` queryable from the frontend:

**Dashboard → Settings → API → Exposed schemas**
Add `partners` to the comma-separated list (so it reads `public, graphql_public, partners`) and click **Save**.

The migration already runs:
```sql
GRANT USAGE ON SCHEMA partners TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA partners
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA partners
  GRANT SELECT ON TABLES TO anon;
```

So once the schema is exposed, anon/authenticated already have the privileges they need (RLS still gates row visibility).

---

## 3. Frontend access pattern

Use a per-call schema override on the existing Supabase client:

```ts
import { supabase } from "@/integrations/supabase/client";

const { data, error } = await supabase
  .schema("partners")
  .from("campaigns")
  .select("*")
  .order("created_at", { ascending: false });
```

Or create a thin wrapper if you do this often:

```ts
export const partnersDb = supabase.schema("partners");
partnersDb.from("ambassadors").select("*");
```

---

## 4. Granting admin privileges

Admins are stored in `partners.partner_admins` (separate table to avoid recursive RLS). To add an admin:

```sql
INSERT INTO partners.partner_admins (user_id) VALUES ('<auth.users.id>');
```

The `partners.is_admin()` security-definer function powers the admin override on every policy.

---

## 5. Verification queries

```sql
-- Schema present
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'partners';

-- 17 tables (16 business + partner_admins)
SELECT count(*) FROM pg_tables WHERE schemaname = 'partners';

-- 21 enums
SELECT count(*) FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'partners' AND t.typtype = 'e';

-- RLS enabled on every table
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'partners';

-- 8 platforms seeded
SELECT name, slug, commission_pool_rate FROM partners.platforms ORDER BY name;

-- 8 default AI personas
SELECT p.name, ap.name FROM partners.ai_personas ap
JOIN partners.platforms p ON p.id = ap.platform_id
WHERE ap.is_default ORDER BY p.name;

-- updated_at trigger on every table
SELECT event_object_table, trigger_name FROM information_schema.triggers
WHERE trigger_schema = 'partners' AND trigger_name LIKE '%updated_at%';

-- Business triggers
SELECT trigger_name, event_object_table FROM information_schema.triggers
WHERE trigger_schema = 'partners'
  AND trigger_name IN ('trg_sales_commission_split','trg_cs_lifetime_earnings','trg_amb_log_insert','trg_payout_completed');
```

---

## 6. Trigger behavior cheat-sheet

| Trigger | Fires on | Effect |
|---|---|---|
| `trg_<table>_updated_at` | BEFORE UPDATE on every table | Sets `updated_at = now()` |
| `trg_sales_commission_split` | AFTER INSERT on `sales` | Inserts a `commission_splits` row using `partner_tier` snapshot. If partner status is `dormant/churned/suspended` the split flips to trailing (25% partner / 50% ambassador / 25% Dynasty). Otherwise default 50/40/10. |
| `trg_cs_lifetime_earnings` | AFTER UPDATE on `commission_splits` | When status flips to `paid`, increments `partners.total_lifetime_earnings_cents` by partner share. |
| `trg_amb_log_insert` | AFTER INSERT on `ambassadors` | Writes an `ambassador_created` row to `activity_log`. |
| `trg_payout_completed` | AFTER UPDATE on `payouts` | When status flips to `completed`: increments `partners.total_lifetime_paid_cents` (partner payouts only), writes `payout_completed` activity, queues an in-app notification. |

---

## 7. RLS summary

- **partners**: a signed-in user reads/updates only the row where `user_id = auth.uid()`.
- **platforms / ai_personas**: readable by every signed-in user; admin writes.
- **partner_platforms / campaigns / leads / ambassadors / sales / commission_splits / mrr_subscriptions / add_ons**: scoped to `partner_id = partners.current_partner_id()`.
- **outreach_messages / tracking_links**: scoped via the parent ambassador or lead's partner.
- **payouts / notifications**: visible if recipient is the partner, or an ambassador belonging to the partner.
- **activity_log**: visible if `partner_id` matches and `visible_to_partner = true`.
- **service_role** bypasses all policies (Supabase default).
- **admin** override via `partners.is_admin()` on every policy.
