
CREATE TABLE IF NOT EXISTS public.role_sop_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('driver','biker','ambassador','production','office','wholesaler')),
  title text NOT NULL,
  title_es text,
  step_order int NOT NULL DEFAULT 0,
  content_md text NOT NULL DEFAULT '',
  content_md_es text,
  video_url text,
  screenshots jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_first_day boolean NOT NULL DEFAULT false,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.role_sop_modules TO authenticated, anon;
GRANT ALL ON public.role_sop_modules TO service_role;

ALTER TABLE public.role_sop_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rsm_read_active" ON public.role_sop_modules FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE POLICY "rsm_admin_insert" ON public.role_sop_modules FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE POLICY "rsm_admin_update" ON public.role_sop_modules FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE POLICY "rsm_admin_delete" ON public.role_sop_modules FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));

CREATE INDEX IF NOT EXISTS idx_rsm_role_order ON public.role_sop_modules (role, step_order) WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.rsm_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END $fn$;

DROP TRIGGER IF EXISTS trg_rsm_touch ON public.role_sop_modules;
CREATE TRIGGER trg_rsm_touch BEFORE UPDATE ON public.role_sop_modules
  FOR EACH ROW EXECUTE FUNCTION public.rsm_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.role_sop_user_progress (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text,
  first_day_dismissed_at timestamptz,
  first_day_started_at timestamptz,
  completed_module_ids uuid[] NOT NULL DEFAULT '{}',
  last_module_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_sop_user_progress TO authenticated;
GRANT ALL ON public.role_sop_user_progress TO service_role;

ALTER TABLE public.role_sop_user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rsup_self_select" ON public.role_sop_user_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
CREATE POLICY "rsup_self_insert" ON public.role_sop_user_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "rsup_self_update" ON public.role_sop_user_progress FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_rsup_touch ON public.role_sop_user_progress;
CREATE TRIGGER trg_rsup_touch BEFORE UPDATE ON public.role_sop_user_progress
  FOR EACH ROW EXECUTE FUNCTION public.rsm_touch_updated_at();

INSERT INTO public.role_sop_modules (role, title, step_order, content_md, is_first_day) VALUES
('driver','Morning Start',1,$md$# Morning Start

1. Log into the **Driver Portal** with your phone number.
2. Open **My Route** — your stops appear in optimized order with ETA.
3. Tap **Start Day** to begin GPS tracking and clock-in.
4. Confirm vehicle inspection (tires, fuel, signage).

> If a stop is missing, contact dispatch in the **Inbox** tab.$md$,true),
('driver','Running the Route',2,$md$# Running the Route

- Each stop shows the store name, contact, last-order, and notes.
- Mark **Delivered** when tubes are dropped — capture a photo of the placement.
- Mark **Skipped** with a reason (closed, no contact, refused) — this feeds Field Ops.
- Use **Navigate** to open turn-by-turn directions.$md$,false),
('driver','End-of-Day Notes (Required)',3,$md$# End-of-Day Notes

**This is required before clock-out.**

1. Open the **End-of-Day** screen.
2. Note any store changes (manager turnover, hours, attitude).
3. Log issues (truck, accidents, customer disputes).
4. Submit cash collected (if any) and confirm tube counts.
5. Tap **Close Day** — the office is notified automatically.$md$,false),

('biker','Pick Up Your Bag',1,$md$# Pick Up Your Bag

1. Sign into the **Biker Portal**.
2. Check **Todays Drops** — usually 8 to 20 stops in your zone.
3. Pick up the prepacked bag at the warehouse window.
4. Verify item count before leaving.$md$,true),
('biker','Drop & Confirm',2,$md$# Drop & Confirm

- Each drop has a small map and the store contact.
- Hand the order, snap a photo, tap **Delivered**.
- If you wait more than 5 minutes, tap **Long Wait** so we can re-route you.$md$,false),
('biker','Return & Close',3,$md$# Return & Close

1. Return any undelivered items to the warehouse.
2. Close your day on the portal — payout calculates automatically.
3. Report any bike issues in **Inbox**.$md$,false),

('ambassador','Store Capture',1,$md$# Capture a New Store

1. Walk into a candidate store.
2. Open **Ambassador Portal → Capture Store**.
3. Snap the storefront photo (auto-GPS).
4. Confirm name, address, manager contact.
5. The store enters your pipeline — you earn credit if it onboards.$md$,true),
('ambassador','Pitch the Catalog',2,$md$# Pitch the Dynasty Direct Catalog

- Open **DD Catalog** in your portal — browse by category.
- Show the manager the bestselling SKUs (top-rated badge).
- Mention auto-replenishment and same-week delivery.$md$,false),
('ambassador','Place the DD Order',3,$md$# Place the First DD Order

1. From the catalog, build the cart for the store.
2. Tap **Submit DD Order** — store gets an SMS confirmation.
3. Order routes to the wholesaler automatically.
4. You see commission accrue under **Commissions**.$md$,false),
('ambassador','Commissions & Payouts',4,$md$# Track Commissions

- Commission ledger updates as orders ship.
- Payouts run weekly to your linked account.
- Disputes can be opened on any line item under **Commission Detail**.$md$,false),

('production','Batch Entry — Log Tubes Total',1,$md$# Batch Entry

**Critical: log `tubes_total` accurately — it feeds inventory and cost models.**

1. Open **Production Portal → New Batch**.
2. Enter SKU, materials used, and worker(s) on the batch.
3. **Enter `tubes_total`** — the count of tubes produced. Double-check.
4. Submit — batch moves to QA queue.$md$,true),
('production','Daily Checklist',2,$md$# Daily Checklist

- Machine warm-up logged.
- Materials pulled from inventory (auto-decrements).
- Safety walk completed.
- Cleaning at shift change recorded.$md$,false),
('production','Day Close',3,$md$# Day Close

1. Run **Day Close** at end of shift.
2. Review the day batches (count, scrap, downtime).
3. Submit — locks the day entries; only floor lead can reopen.$md$,false),

('office','Morning Sweep',1,$md$# Office Morning Sweep

Start every day with these in order:

1. Open **/system-health** — confirm all sections are **green**. Address any red/amber before anything else.
2. Open the **Route Command Center** — verify all routes have a driver assigned and all biker drops have a courier.
3. Open the **Inbox** — triage messages from drivers, ambassadors, and wholesalers.
4. Open the **Approval Queues** (orders, ambassador apps, supplier apps) — clear backlog.$md$,true),
('office','Approval Queues',2,$md$# Approval Queues

- **Store Applications**: review docs, approve or request more info.
- **Wholesaler Applications**: verify EIN + bank, approve.
- **DD Orders > $X**: high-value orders require a second eye.

Use the **Triage** AI score as a guide, never as the final decision.$md$,false),

('wholesaler','Fulfill an Order',1,$md$# Fulfill an Order

1. Sign into the **Wholesaler Portal**.
2. Open **Orders → Pending** — new DD orders show with line items.
3. Tap **Pick & Pack** — print the pick-list, gather inventory.
4. Tap **Mark Packed** when ready for pickup.$md$,true),
('wholesaler','Ship & Confirm',2,$md$# Ship the Order

- Hand to the driver or courier, or attach the shipping label.
- Tap **Mark Shipped** — the buyer is notified.
- Tracking syncs automatically from your carrier integration.$md$,false),
('wholesaler','Inventory Management',3,$md$# Manage Inventory

- Inventory auto-decrements on shipment.
- Restock counts under **Inventory → Adjust**.
- Low-stock alerts ping you when SKUs drop below reorder point.$md$,false),
('wholesaler','Upload New Products',4,$md$# Upload Products

- One at a time: **Products → New** form (photos, MSRP, wholesale price).
- Bulk: drag-and-drop an **.xlsx** under **Products → Bulk Upload** — AI categorizes automatically.
- Approved products appear in the Ambassador catalog within minutes.$md$,false)
ON CONFLICT DO NOTHING;
