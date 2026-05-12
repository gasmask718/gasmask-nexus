-- ============================================================================
-- DYNASTY PARTNERS — Schema, Enums, Tables, RLS, Triggers, Seeds (retry)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS partners;

GRANT USAGE ON SCHEMA partners TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA partners
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA partners
  GRANT SELECT ON TABLES TO anon;

-- ENUMS
CREATE TYPE partners.partner_tier        AS ENUM ('foundation','equity','sovereign');
CREATE TYPE partners.partner_status      AS ENUM ('pending_onboarding','active','dormant','suspended','churned');
CREATE TYPE partners.platform_status     AS ENUM ('active','draft','archived','maintenance');
CREATE TYPE partners.platform_tracking   AS ENUM ('shopify','stripe_webhook','custom_pixel','manual');
CREATE TYPE partners.campaign_status     AS ENUM ('draft','sourcing','outreach','active','paused','completed');
CREATE TYPE partners.campaign_type       AS ENUM ('ig_dm','tiktok_dm','sms_blast','email','paid_ads','mixed');
CREATE TYPE partners.lead_source         AS ENUM ('ig_scrape','tiktok_scrape','apollo','paid_ad','manual','referral');
CREATE TYPE partners.lead_status         AS ENUM ('new','scoring','contacted','replied','qualified','onboarding','onboarded','archived','do_not_contact','needs_human');
CREATE TYPE partners.ambassador_status   AS ENUM ('onboarding','active','dormant','churned','banned');
CREATE TYPE partners.outreach_channel    AS ENUM ('ig_dm','tiktok_dm','sms','email');
CREATE TYPE partners.outreach_direction  AS ENUM ('outbound','inbound');
CREATE TYPE partners.outreach_status     AS ENUM ('queued','sent','delivered','read','replied','failed','blocked');
CREATE TYPE partners.sale_status         AS ENUM ('pending','completed','refunded','disputed','chargebacked');
CREATE TYPE partners.commission_status   AS ENUM ('pending','paid','held','clawed_back','voided');
CREATE TYPE partners.payout_recipient    AS ENUM ('ambassador','partner');
CREATE TYPE partners.payout_status       AS ENUM ('scheduled','processing','completed','failed','reversed');
CREATE TYPE partners.subscription_status AS ENUM ('active','past_due','canceled','paused');
CREATE TYPE partners.activity_actor      AS ENUM ('system','ai_agent','admin','partner','ambassador');
CREATE TYPE partners.notification_channel AS ENUM ('push','email','sms','in_app');
CREATE TYPE partners.notification_status  AS ENUM ('queued','sent','delivered','failed','read');

-- updated_at trigger function
CREATE OR REPLACE FUNCTION partners.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Admin table
CREATE TABLE partners.partner_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE partners.partner_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins self-read" ON partners.partner_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION partners.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = partners, public
AS $$ SELECT EXISTS (SELECT 1 FROM partners.partner_admins WHERE user_id = auth.uid()); $$;

-- 1. partners
CREATE TABLE partners.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tier partners.partner_tier NOT NULL,
  status partners.partner_status NOT NULL DEFAULT 'pending_onboarding',
  stripe_customer_id text UNIQUE,
  stripe_entry_payment_id text,
  stripe_subscription_id text UNIQUE,
  entry_fee_amount integer,
  mrr_amount integer,
  entry_fee_paid_at timestamptz,
  mrr_active_until timestamptz,
  dormant_since timestamptz,
  reactivation_count integer DEFAULT 0,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  business_name text,
  profile_data jsonb DEFAULT '{}'::jsonb,
  total_lifetime_earnings_cents bigint DEFAULT 0,
  total_lifetime_paid_cents bigint DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_partners_email ON partners.partners(email);
CREATE INDEX idx_partners_stripe_customer ON partners.partners(stripe_customer_id);
CREATE INDEX idx_partners_status ON partners.partners(status);
CREATE INDEX idx_partners_tier ON partners.partners(tier);
CREATE INDEX idx_partners_user_id ON partners.partners(user_id);

-- now safe to define helper
CREATE OR REPLACE FUNCTION partners.current_partner_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = partners, public
AS $$ SELECT id FROM partners.partners WHERE user_id = auth.uid() LIMIT 1; $$;

-- 2. platforms
CREATE TABLE partners.platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  commission_pool_rate numeric(5,4) DEFAULT 0.30,
  status partners.platform_status DEFAULT 'active',
  tracking_method partners.platform_tracking NOT NULL,
  logo_url text,
  brand_color text,
  product_base_url text,
  stripe_account_id text,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_platforms_status ON partners.platforms(status);

-- 5. ai_personas
CREATE TABLE partners.ai_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform_id uuid REFERENCES partners.platforms(id) ON DELETE SET NULL,
  voice_description text,
  sample_messages jsonb DEFAULT '[]'::jsonb,
  system_prompt text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_personas_platform ON partners.ai_personas(platform_id);

-- 3. partner_platforms
CREATE TABLE partners.partner_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners.partners(id) ON DELETE CASCADE,
  platform_id uuid NOT NULL REFERENCES partners.platforms(id) ON DELETE RESTRICT,
  activated_at timestamptz DEFAULT now(),
  deactivated_at timestamptz,
  custom_commission_rate numeric(5,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, platform_id)
);
CREATE INDEX idx_pp_partner ON partners.partner_platforms(partner_id);
CREATE INDEX idx_pp_platform ON partners.partner_platforms(platform_id);

-- 4. campaigns
CREATE TABLE partners.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners.partners(id) ON DELETE CASCADE,
  platform_id uuid NOT NULL REFERENCES partners.platforms(id) ON DELETE RESTRICT,
  name text NOT NULL,
  type partners.campaign_type NOT NULL,
  status partners.campaign_status DEFAULT 'draft',
  target_ambassador_count integer DEFAULT 25,
  current_ambassador_count integer DEFAULT 0,
  budget_cents integer DEFAULT 0,
  spent_cents integer DEFAULT 0,
  start_date timestamptz,
  end_date timestamptz,
  ai_persona_id uuid REFERENCES partners.ai_personas(id) ON DELETE SET NULL,
  messaging_config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_partner ON partners.campaigns(partner_id);
CREATE INDEX idx_campaigns_platform ON partners.campaigns(platform_id);
CREATE INDEX idx_campaigns_status ON partners.campaigns(status);
CREATE INDEX idx_campaigns_persona ON partners.campaigns(ai_persona_id);

-- 6. leads
CREATE TABLE partners.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES partners.campaigns(id) ON DELETE SET NULL,
  platform_id uuid REFERENCES partners.platforms(id),
  partner_id uuid REFERENCES partners.partners(id) ON DELETE CASCADE,
  source partners.lead_source NOT NULL,
  external_id text,
  external_handle text,
  profile_data jsonb DEFAULT '{}'::jsonb,
  fit_score integer,
  status partners.lead_status DEFAULT 'new',
  touch_count integer DEFAULT 0,
  last_contacted_at timestamptz,
  last_response_at timestamptz,
  converted_at timestamptz,
  archived_at timestamptz,
  archive_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_partner_status ON partners.leads(partner_id, status);
CREATE INDEX idx_leads_fit_score ON partners.leads(fit_score DESC);
CREATE INDEX idx_leads_last_contacted ON partners.leads(last_contacted_at);
CREATE INDEX idx_leads_campaign ON partners.leads(campaign_id);
CREATE INDEX idx_leads_platform ON partners.leads(platform_id);

-- 9. tracking_links (FK to ambassadors deferred)
CREATE TABLE partners.tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid,
  platform_id uuid REFERENCES partners.platforms(id),
  campaign_id uuid REFERENCES partners.campaigns(id) ON DELETE SET NULL,
  short_code text NOT NULL UNIQUE,
  destination_url text NOT NULL,
  click_count integer DEFAULT 0,
  conversion_count integer DEFAULT 0,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tracking_short_code ON partners.tracking_links(short_code);
CREATE INDEX idx_tracking_platform ON partners.tracking_links(platform_id);
CREATE INDEX idx_tracking_campaign ON partners.tracking_links(campaign_id);

-- 7. ambassadors
CREATE TABLE partners.ambassadors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES partners.leads(id) ON DELETE SET NULL,
  partner_id uuid NOT NULL REFERENCES partners.partners(id) ON DELETE CASCADE,
  platform_id uuid REFERENCES partners.platforms(id),
  campaign_id uuid REFERENCES partners.campaigns(id) ON DELETE SET NULL,
  status partners.ambassador_status DEFAULT 'onboarding',
  full_name text,
  email text,
  phone text,
  external_handle text,
  contract_signed_at timestamptz,
  contract_envelope_id text,
  contract_url text,
  stripe_connect_account_id text,
  payout_method text DEFAULT 'stripe_connect',
  tracking_link_id uuid REFERENCES partners.tracking_links(id) ON DELETE SET NULL,
  promo_kit_url text,
  total_sales_count integer DEFAULT 0,
  total_sales_volume_cents bigint DEFAULT 0,
  total_commission_earned_cents bigint DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  churned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ambassadors_partner ON partners.ambassadors(partner_id);
CREATE INDEX idx_ambassadors_status ON partners.ambassadors(status);
CREATE INDEX idx_ambassadors_platform ON partners.ambassadors(platform_id);
CREATE INDEX idx_ambassadors_campaign ON partners.ambassadors(campaign_id);
CREATE INDEX idx_ambassadors_lead ON partners.ambassadors(lead_id);
CREATE INDEX idx_ambassadors_tracking_link ON partners.ambassadors(tracking_link_id);

ALTER TABLE partners.tracking_links
  ADD CONSTRAINT tracking_links_ambassador_fk
  FOREIGN KEY (ambassador_id) REFERENCES partners.ambassadors(id) ON DELETE CASCADE;
CREATE INDEX idx_tracking_ambassador ON partners.tracking_links(ambassador_id);

-- 8. outreach_messages
CREATE TABLE partners.outreach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES partners.leads(id) ON DELETE CASCADE,
  ambassador_id uuid REFERENCES partners.ambassadors(id) ON DELETE CASCADE,
  channel partners.outreach_channel NOT NULL,
  direction partners.outreach_direction NOT NULL,
  touch_number integer,
  content text NOT NULL,
  ai_generated boolean DEFAULT true,
  ai_model text,
  status partners.outreach_status DEFAULT 'queued',
  external_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_outreach_lead ON partners.outreach_messages(lead_id);
CREATE INDEX idx_outreach_ambassador ON partners.outreach_messages(ambassador_id);
CREATE INDEX idx_outreach_status ON partners.outreach_messages(status);
CREATE INDEX idx_outreach_sent_at ON partners.outreach_messages(sent_at DESC);

-- 10. sales
CREATE TABLE partners.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL REFERENCES partners.ambassadors(id) ON DELETE RESTRICT,
  partner_id uuid NOT NULL REFERENCES partners.partners(id),
  platform_id uuid NOT NULL REFERENCES partners.platforms(id),
  tracking_link_id uuid REFERENCES partners.tracking_links(id),
  external_sale_id text NOT NULL,
  amount_cents integer NOT NULL,
  currency text DEFAULT 'USD',
  customer_email_hash text,
  commission_pool_cents integer NOT NULL,
  status partners.sale_status DEFAULT 'pending',
  sold_at timestamptz NOT NULL,
  cleared_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform_id, external_sale_id)
);
CREATE INDEX idx_sales_ambassador ON partners.sales(ambassador_id);
CREATE INDEX idx_sales_partner ON partners.sales(partner_id);
CREATE INDEX idx_sales_sold_at ON partners.sales(sold_at DESC);
CREATE INDEX idx_sales_status ON partners.sales(status);
CREATE INDEX idx_sales_tracking ON partners.sales(tracking_link_id);

-- 12. payouts
CREATE TABLE partners.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type partners.payout_recipient NOT NULL,
  recipient_id uuid NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  total_amount_cents integer NOT NULL,
  currency text DEFAULT 'USD',
  stripe_transfer_id text UNIQUE,
  status partners.payout_status DEFAULT 'scheduled',
  scheduled_for timestamptz NOT NULL,
  processed_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payouts_recipient ON partners.payouts(recipient_type, recipient_id);
CREATE INDEX idx_payouts_status ON partners.payouts(status);
CREATE INDEX idx_payouts_scheduled ON partners.payouts(scheduled_for);

-- 11. commission_splits
CREATE TABLE partners.commission_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES partners.sales(id) ON DELETE RESTRICT,
  ambassador_id uuid NOT NULL REFERENCES partners.ambassadors(id),
  partner_id uuid NOT NULL REFERENCES partners.partners(id),
  ambassador_share_cents integer NOT NULL,
  partner_share_cents integer NOT NULL,
  dynasty_share_cents integer NOT NULL,
  partner_tier_at_sale partners.partner_tier NOT NULL,
  is_trailing boolean DEFAULT false,
  status partners.commission_status DEFAULT 'pending',
  paid_at timestamptz,
  payout_id uuid REFERENCES partners.payouts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cs_partner_status ON partners.commission_splits(partner_id, status);
CREATE INDEX idx_cs_paid_at ON partners.commission_splits(paid_at DESC);
CREATE INDEX idx_cs_sale ON partners.commission_splits(sale_id);
CREATE INDEX idx_cs_ambassador ON partners.commission_splits(ambassador_id);
CREATE INDEX idx_cs_payout ON partners.commission_splits(payout_id);

-- 13. mrr_subscriptions
CREATE TABLE partners.mrr_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners.partners(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL UNIQUE,
  tier partners.partner_tier NOT NULL,
  monthly_amount_cents integer NOT NULL,
  status partners.subscription_status DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  next_billing_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mrr_partner ON partners.mrr_subscriptions(partner_id);
CREATE INDEX idx_mrr_status ON partners.mrr_subscriptions(status);

-- 14. activity_log
CREATE TABLE partners.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type partners.activity_actor NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  partner_id uuid REFERENCES partners.partners(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}'::jsonb,
  visible_to_partner boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_partner_visible
  ON partners.activity_log(partner_id, created_at DESC)
  WHERE visible_to_partner = true;

-- 15. notifications
CREATE TABLE partners.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  recipient_type text NOT NULL,
  channel partners.notification_channel NOT NULL,
  subject text,
  body text NOT NULL,
  link_url text,
  status partners.notification_status DEFAULT 'queued',
  scheduled_for timestamptz DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_recipient ON partners.notifications(recipient_type, recipient_id);
CREATE INDEX idx_notif_status ON partners.notifications(status);
CREATE INDEX idx_notif_scheduled ON partners.notifications(scheduled_for);

-- 16. add_ons
CREATE TABLE partners.add_ons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners.partners(id) ON DELETE CASCADE,
  addon_type text NOT NULL,
  amount_cents integer NOT NULL,
  stripe_payment_id text,
  status text DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  purchased_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_addons_partner ON partners.add_ons(partner_id);
CREATE INDEX idx_addons_status ON partners.add_ons(status);

-- updated_at triggers on every partners table
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'partners' LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON partners.%I
       FOR EACH ROW EXECUTE FUNCTION partners.set_updated_at();', t, t);
  END LOOP;
END $$;

-- Business logic triggers
CREATE OR REPLACE FUNCTION partners.fn_create_commission_split()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = partners, public AS $$
DECLARE
  v_tier partners.partner_tier; v_status partners.partner_status;
  v_is_trailing boolean := false;
  v_partner_pct numeric := 0.50; v_ambassador_pct numeric := 0.40; v_dynasty_pct numeric := 0.10;
  v_amb integer; v_part integer; v_dyn integer;
BEGIN
  SELECT tier, status INTO v_tier, v_status FROM partners.partners WHERE id = NEW.partner_id;
  IF v_status IN ('dormant','churned','suspended') THEN
    v_is_trailing := true;
    v_partner_pct := 0.25; v_ambassador_pct := 0.50; v_dynasty_pct := 0.25;
  END IF;
  v_amb  := round(NEW.commission_pool_cents * v_ambassador_pct);
  v_part := round(NEW.commission_pool_cents * v_partner_pct);
  v_dyn  := NEW.commission_pool_cents - v_amb - v_part;
  INSERT INTO partners.commission_splits (
    sale_id, ambassador_id, partner_id,
    ambassador_share_cents, partner_share_cents, dynasty_share_cents,
    partner_tier_at_sale, is_trailing
  ) VALUES (
    NEW.id, NEW.ambassador_id, NEW.partner_id,
    v_amb, v_part, v_dyn, v_tier, v_is_trailing
  );
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_sales_commission_split
  AFTER INSERT ON partners.sales
  FOR EACH ROW EXECUTE FUNCTION partners.fn_create_commission_split();

CREATE OR REPLACE FUNCTION partners.fn_increment_lifetime_earnings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = partners, public AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    UPDATE partners.partners
       SET total_lifetime_earnings_cents = total_lifetime_earnings_cents + NEW.partner_share_cents
     WHERE id = NEW.partner_id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_cs_lifetime_earnings
  AFTER UPDATE ON partners.commission_splits
  FOR EACH ROW EXECUTE FUNCTION partners.fn_increment_lifetime_earnings();

CREATE OR REPLACE FUNCTION partners.fn_log_ambassador_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = partners, public AS $$
BEGIN
  INSERT INTO partners.activity_log (
    actor_type, action, entity_type, entity_id, partner_id, metadata
  ) VALUES (
    'system', 'ambassador_created', 'ambassador', NEW.id, NEW.partner_id,
    jsonb_build_object('full_name', NEW.full_name, 'platform_id', NEW.platform_id)
  );
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_amb_log_insert
  AFTER INSERT ON partners.ambassadors
  FOR EACH ROW EXECUTE FUNCTION partners.fn_log_ambassador_insert();

CREATE OR REPLACE FUNCTION partners.fn_payout_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = partners, public AS $$
DECLARE v_partner_id uuid;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    IF NEW.recipient_type = 'partner' THEN
      v_partner_id := NEW.recipient_id;
      UPDATE partners.partners
         SET total_lifetime_paid_cents = total_lifetime_paid_cents + NEW.total_amount_cents
       WHERE id = NEW.recipient_id;
    ELSE
      SELECT partner_id INTO v_partner_id FROM partners.ambassadors WHERE id = NEW.recipient_id;
    END IF;
    INSERT INTO partners.activity_log (
      actor_type, action, entity_type, entity_id, partner_id, metadata
    ) VALUES (
      'system', 'payout_completed', 'payout', NEW.id, v_partner_id,
      jsonb_build_object('amount_cents', NEW.total_amount_cents,
                         'recipient_type', NEW.recipient_type,
                         'recipient_id', NEW.recipient_id)
    );
    INSERT INTO partners.notifications (
      recipient_id, recipient_type, channel, subject, body
    ) VALUES (
      NEW.recipient_id, NEW.recipient_type::text, 'in_app',
      'Payout completed',
      format('Your payout of $%s has been sent.',
             to_char(NEW.total_amount_cents/100.0, 'FM999,990.00'))
    );
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_payout_completed
  AFTER UPDATE ON partners.payouts
  FOR EACH ROW EXECUTE FUNCTION partners.fn_payout_completed();

-- RLS enable
ALTER TABLE partners.partners            ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners.platforms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners.ai_personas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners.partner_platforms   ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners.campaigns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners.leads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners.tracking_links      ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners.ambassadors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners.outreach_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners.sales               ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners.payouts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners.commission_splits   ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners.mrr_subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners.activity_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners.notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners.add_ons             ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "partner self select" ON partners.partners
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR partners.is_admin());
CREATE POLICY "partner self update" ON partners.partners
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR partners.is_admin())
  WITH CHECK (user_id = auth.uid() OR partners.is_admin());
CREATE POLICY "admin insert partners" ON partners.partners
  FOR INSERT TO authenticated WITH CHECK (partners.is_admin());
CREATE POLICY "admin delete partners" ON partners.partners
  FOR DELETE TO authenticated USING (partners.is_admin());

CREATE POLICY "platforms read all" ON partners.platforms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "platforms admin write" ON partners.platforms
  FOR ALL TO authenticated USING (partners.is_admin()) WITH CHECK (partners.is_admin());

CREATE POLICY "personas read all" ON partners.ai_personas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "personas admin write" ON partners.ai_personas
  FOR ALL TO authenticated USING (partners.is_admin()) WITH CHECK (partners.is_admin());

CREATE POLICY "pp partner scope" ON partners.partner_platforms
  FOR SELECT TO authenticated
  USING (partner_id = partners.current_partner_id() OR partners.is_admin());
CREATE POLICY "pp admin write" ON partners.partner_platforms
  FOR ALL TO authenticated USING (partners.is_admin()) WITH CHECK (partners.is_admin());

CREATE POLICY "campaigns partner scope" ON partners.campaigns
  FOR SELECT TO authenticated
  USING (partner_id = partners.current_partner_id() OR partners.is_admin());
CREATE POLICY "campaigns partner write" ON partners.campaigns
  FOR ALL TO authenticated
  USING (partner_id = partners.current_partner_id() OR partners.is_admin())
  WITH CHECK (partner_id = partners.current_partner_id() OR partners.is_admin());

CREATE POLICY "leads partner scope" ON partners.leads
  FOR SELECT TO authenticated
  USING (partner_id = partners.current_partner_id() OR partners.is_admin());
CREATE POLICY "leads admin write" ON partners.leads
  FOR ALL TO authenticated USING (partners.is_admin()) WITH CHECK (partners.is_admin());

CREATE POLICY "ambassadors partner scope" ON partners.ambassadors
  FOR SELECT TO authenticated
  USING (partner_id = partners.current_partner_id() OR partners.is_admin());
CREATE POLICY "ambassadors admin write" ON partners.ambassadors
  FOR ALL TO authenticated USING (partners.is_admin()) WITH CHECK (partners.is_admin());

CREATE POLICY "outreach partner scope" ON partners.outreach_messages
  FOR SELECT TO authenticated
  USING (
    partners.is_admin() OR
    EXISTS (SELECT 1 FROM partners.leads l WHERE l.id = outreach_messages.lead_id AND l.partner_id = partners.current_partner_id()) OR
    EXISTS (SELECT 1 FROM partners.ambassadors a WHERE a.id = outreach_messages.ambassador_id AND a.partner_id = partners.current_partner_id())
  );
CREATE POLICY "outreach admin write" ON partners.outreach_messages
  FOR ALL TO authenticated USING (partners.is_admin()) WITH CHECK (partners.is_admin());

CREATE POLICY "tracking partner scope" ON partners.tracking_links
  FOR SELECT TO authenticated
  USING (
    partners.is_admin() OR
    EXISTS (SELECT 1 FROM partners.ambassadors a WHERE a.id = tracking_links.ambassador_id AND a.partner_id = partners.current_partner_id())
  );
CREATE POLICY "tracking admin write" ON partners.tracking_links
  FOR ALL TO authenticated USING (partners.is_admin()) WITH CHECK (partners.is_admin());

CREATE POLICY "sales partner scope" ON partners.sales
  FOR SELECT TO authenticated
  USING (partner_id = partners.current_partner_id() OR partners.is_admin());
CREATE POLICY "sales admin write" ON partners.sales
  FOR ALL TO authenticated USING (partners.is_admin()) WITH CHECK (partners.is_admin());

CREATE POLICY "cs partner scope" ON partners.commission_splits
  FOR SELECT TO authenticated
  USING (partner_id = partners.current_partner_id() OR partners.is_admin());
CREATE POLICY "cs admin write" ON partners.commission_splits
  FOR ALL TO authenticated USING (partners.is_admin()) WITH CHECK (partners.is_admin());

CREATE POLICY "payouts partner scope" ON partners.payouts
  FOR SELECT TO authenticated
  USING (
    partners.is_admin() OR
    (recipient_type = 'partner' AND recipient_id = partners.current_partner_id()) OR
    (recipient_type = 'ambassador' AND EXISTS (
       SELECT 1 FROM partners.ambassadors a
        WHERE a.id = payouts.recipient_id
          AND a.partner_id = partners.current_partner_id()))
  );
CREATE POLICY "payouts admin write" ON partners.payouts
  FOR ALL TO authenticated USING (partners.is_admin()) WITH CHECK (partners.is_admin());

CREATE POLICY "mrr partner scope" ON partners.mrr_subscriptions
  FOR SELECT TO authenticated
  USING (partner_id = partners.current_partner_id() OR partners.is_admin());
CREATE POLICY "mrr admin write" ON partners.mrr_subscriptions
  FOR ALL TO authenticated USING (partners.is_admin()) WITH CHECK (partners.is_admin());

CREATE POLICY "activity partner scope" ON partners.activity_log
  FOR SELECT TO authenticated
  USING (
    partners.is_admin() OR
    (partner_id = partners.current_partner_id() AND visible_to_partner = true)
  );
CREATE POLICY "activity admin write" ON partners.activity_log
  FOR ALL TO authenticated USING (partners.is_admin()) WITH CHECK (partners.is_admin());

CREATE POLICY "notif partner scope" ON partners.notifications
  FOR SELECT TO authenticated
  USING (
    partners.is_admin() OR
    (recipient_type = 'partner' AND recipient_id = partners.current_partner_id()) OR
    (recipient_type = 'ambassador' AND EXISTS (
       SELECT 1 FROM partners.ambassadors a
        WHERE a.id = notifications.recipient_id
          AND a.partner_id = partners.current_partner_id()))
  );
CREATE POLICY "notif partner update" ON partners.notifications
  FOR UPDATE TO authenticated
  USING (
    (recipient_type = 'partner' AND recipient_id = partners.current_partner_id())
    OR partners.is_admin()
  );
CREATE POLICY "notif admin insert" ON partners.notifications
  FOR INSERT TO authenticated WITH CHECK (partners.is_admin());
CREATE POLICY "notif admin delete" ON partners.notifications
  FOR DELETE TO authenticated USING (partners.is_admin());

CREATE POLICY "addons partner scope" ON partners.add_ons
  FOR SELECT TO authenticated
  USING (partner_id = partners.current_partner_id() OR partners.is_admin());
CREATE POLICY "addons partner write" ON partners.add_ons
  FOR ALL TO authenticated
  USING (partner_id = partners.current_partner_id() OR partners.is_admin())
  WITH CHECK (partner_id = partners.current_partner_id() OR partners.is_admin());

-- Seeds: 8 platforms
INSERT INTO partners.platforms (name, slug, description, commission_pool_rate, status, tracking_method, brand_color, product_base_url) VALUES
  ('TopTier Experience',   'toptier-experience',   'Luxury experiences, exotic cars, yachts, helicopters', 0.30, 'active', 'stripe_webhook', '#0A0A0A', 'https://toptier.com'),
  ('Unforgettable Times',  'unforgettable-times',  'Event marketplace and curation',                       0.30, 'active', 'stripe_webhook', '#1F2937', 'https://unforgettabletimes.com'),
  ('Playboxxx',            'playboxxx',            'Creator monetization platform',                        0.35, 'active', 'custom_pixel',   '#FF0066', 'https://playboxxx.com'),
  ('GasMask Distribution', 'gasmask-distribution', 'GasMask product distribution & route engine',         0.25, 'active', 'shopify',        '#111827', 'https://gasmask.com'),
  ('iClean WeClean',       'iclean-weclean',       'Cleaning service marketplace',                         0.25, 'active', 'manual',         '#0EA5E9', 'https://icleanweclean.com'),
  ('Brandaro Digital',     'brandaro-digital',     'Brandaro VA + digital services',                       0.30, 'active', 'stripe_webhook', '#7C3AED', 'https://brandarodigital.com'),
  ('Dynasty Connect',      'dynasty-connect',      'Voice ops and Twilio communications',                  0.20, 'active', 'manual',         '#0891B2', 'https://dynastyconnect.com'),
  ('UBEN',                 'uben',                 'Non-profit ambassador and impact platform',            0.30, 'active', 'manual',         '#B45309', 'https://uben.org')
ON CONFLICT (slug) DO NOTHING;

-- Seeds: AI personas (one per platform)
INSERT INTO partners.ai_personas (name, platform_id, voice_description, system_prompt, is_default)
SELECT
  p.name || ' Default Closer',
  p.id,
  'Warm, high-status, brand-aligned voice for ' || p.name,
  'You are an outreach AI for ' || p.name || '. Speak in a confident, concise, brand-aligned voice. Open with a personalized observation, present the partnership in one sentence, end with a single low-friction question. Keep DMs under 280 characters.',
  true
FROM partners.platforms p;
