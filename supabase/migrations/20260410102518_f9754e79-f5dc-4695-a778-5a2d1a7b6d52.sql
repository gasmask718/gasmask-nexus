
-- =============================================
-- EXTEND exotic_car_inventory
-- =============================================
ALTER TABLE public.exotic_car_inventory
  ADD COLUMN IF NOT EXISTS self_drive_daily_rate numeric,
  ADD COLUMN IF NOT EXISTS chauffeur_hourly_rate numeric,
  ADD COLUMN IF NOT EXISTS supports_self_drive boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS supports_chauffeur boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS minimum_rental_days integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS minimum_chauffeur_hours integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS pickup_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_fee_base numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hotel_delivery_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS airport_delivery_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS residence_delivery_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS chauffeur_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS request_to_source boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS state text;

-- =============================================
-- EXTEND exotic_car_requests
-- =============================================
ALTER TABLE public.exotic_car_requests
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS assigned_staff_user_id uuid,
  ADD COLUMN IF NOT EXISTS urgency_level text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS estimated_value numeric,
  ADD COLUMN IF NOT EXISTS internal_priority integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latest_status_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source_channel text,
  ADD COLUMN IF NOT EXISTS acceptable_alternatives text[],
  ADD COLUMN IF NOT EXISTS is_same_day boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_type text DEFAULT 'self_drive',
  ADD COLUMN IF NOT EXISTS rental_start_date date,
  ADD COLUMN IF NOT EXISTS rental_end_date date,
  ADD COLUMN IF NOT EXISTS rental_days integer,
  ADD COLUMN IF NOT EXISTS chauffeur_start_time timestamptz,
  ADD COLUMN IF NOT EXISTS chauffeur_end_time timestamptz,
  ADD COLUMN IF NOT EXISTS chauffeur_hours integer,
  ADD COLUMN IF NOT EXISTS selected_city text,
  ADD COLUMN IF NOT EXISTS fulfillment_mode text,
  ADD COLUMN IF NOT EXISTS delivery_type text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_requested boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_fee_estimate numeric,
  ADD COLUMN IF NOT EXISTS pickup_location text,
  ADD COLUMN IF NOT EXISTS pickup_instructions text,
  ADD COLUMN IF NOT EXISTS dropoff_location text,
  ADD COLUMN IF NOT EXISTS extra_stops jsonb,
  ADD COLUMN IF NOT EXISTS source_vehicle_id uuid,
  ADD COLUMN IF NOT EXISTS has_customer_insurance boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_upload_url text,
  ADD COLUMN IF NOT EXISTS insurance_option_selected text,
  ADD COLUMN IF NOT EXISTS insurance_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drivers_license_upload_url text,
  ADD COLUMN IF NOT EXISTS driver_full_name text,
  ADD COLUMN IF NOT EXISTS driver_date_of_birth date,
  ADD COLUMN IF NOT EXISTS deposit_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_authorization_status text,
  ADD COLUMN IF NOT EXISTS payment_method_token text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS favorite_song text,
  ADD COLUMN IF NOT EXISTS favorite_color text,
  ADD COLUMN IF NOT EXISTS flower_package text,
  ADD COLUMN IF NOT EXISTS car_decor_package text,
  ADD COLUMN IF NOT EXISTS hotel_decor_package text,
  ADD COLUMN IF NOT EXISTS hotel_name text,
  ADD COLUMN IF NOT EXISTS hotel_address text,
  ADD COLUMN IF NOT EXISTS hotel_room_number text,
  ADD COLUMN IF NOT EXISTS coordination_notes text;

-- =============================================
-- EXTEND exotic_car_partner_requests
-- =============================================
ALTER TABLE public.exotic_car_partner_requests
  ADD COLUMN IF NOT EXISTS sent_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS outreach_channel text DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS internal_rank integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_followup_at timestamptz;

-- =============================================
-- EXTEND exotic_car_quotes
-- =============================================
ALTER TABLE public.exotic_car_quotes
  ADD COLUMN IF NOT EXISTS recommended_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS is_recommended boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_to_customer_at timestamptz,
  ADD COLUMN IF NOT EXISTS viewed_by_customer_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by_customer_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_by_customer_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_margin_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upsell_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chauffeur_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS base_rental_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chauffeur_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_fee_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS add_on_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_required boolean DEFAULT false;

-- =============================================
-- CREATE: exotic_car_request_activity_log
-- =============================================
CREATE TABLE IF NOT EXISTS public.exotic_car_request_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exotic_car_request_id uuid REFERENCES public.exotic_car_requests(id) ON DELETE CASCADE NOT NULL,
  actor_user_id uuid,
  activity_type text NOT NULL,
  activity_label text NOT NULL,
  notes text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.exotic_car_request_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view activity logs" ON public.exotic_car_request_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert activity logs" ON public.exotic_car_request_activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- CREATE: exotic_car_request_internal_notes
-- =============================================
CREATE TABLE IF NOT EXISTS public.exotic_car_request_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exotic_car_request_id uuid REFERENCES public.exotic_car_requests(id) ON DELETE CASCADE NOT NULL,
  author_user_id uuid,
  note_text text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.exotic_car_request_internal_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage internal notes" ON public.exotic_car_request_internal_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- CREATE: exotic_car_request_tasks
-- =============================================
CREATE TABLE IF NOT EXISTS public.exotic_car_request_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exotic_car_request_id uuid REFERENCES public.exotic_car_requests(id) ON DELETE CASCADE NOT NULL,
  assigned_user_id uuid,
  task_title text NOT NULL,
  task_description text,
  due_at timestamptz,
  task_status text DEFAULT 'open',
  priority text DEFAULT 'normal',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.exotic_car_request_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage tasks" ON public.exotic_car_request_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- CREATE: exotic_car_partner_offers
-- =============================================
CREATE TABLE IF NOT EXISTS public.exotic_car_partner_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exotic_car_request_id uuid REFERENCES public.exotic_car_requests(id) ON DELETE CASCADE NOT NULL,
  partner_id uuid REFERENCES public.exotic_car_partners(id),
  inventory_id uuid REFERENCES public.exotic_car_inventory(id),
  offered_make text,
  offered_model text,
  city text,
  drive_mode text,
  delivery_supported boolean DEFAULT false,
  same_day_supported boolean DEFAULT false,
  offer_status text DEFAULT 'pending',
  response_notes text,
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.exotic_car_partner_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage partner offers" ON public.exotic_car_partner_offers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- CREATE: exotic_car_quote_line_items
-- =============================================
CREATE TABLE IF NOT EXISTS public.exotic_car_quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES public.exotic_car_quotes(id) ON DELETE CASCADE NOT NULL,
  line_type text NOT NULL,
  label text NOT NULL,
  description text,
  quantity integer DEFAULT 1,
  unit_price numeric DEFAULT 0,
  total_price numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.exotic_car_quote_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage quote line items" ON public.exotic_car_quote_line_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- CREATE: exotic_car_delivery_tracking
-- =============================================
CREATE TABLE IF NOT EXISTS public.exotic_car_delivery_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exotic_car_request_id uuid REFERENCES public.exotic_car_requests(id) ON DELETE CASCADE NOT NULL,
  quote_id uuid REFERENCES public.exotic_car_quotes(id),
  delivery_type text,
  delivery_address text,
  delivery_time timestamptz,
  pickup_time timestamptz,
  fulfillment_status text DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.exotic_car_delivery_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage delivery tracking" ON public.exotic_car_delivery_tracking FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- CREATE: exotic_car_chauffeur_assignments
-- =============================================
CREATE TABLE IF NOT EXISTS public.exotic_car_chauffeur_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exotic_car_request_id uuid REFERENCES public.exotic_car_requests(id) ON DELETE CASCADE NOT NULL,
  quote_id uuid REFERENCES public.exotic_car_quotes(id),
  chauffeur_name text,
  chauffeur_phone text,
  assignment_status text DEFAULT 'pending',
  start_time timestamptz,
  end_time timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.exotic_car_chauffeur_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage chauffeur assignments" ON public.exotic_car_chauffeur_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- CREATE: exotic_car_payment_tracking
-- =============================================
CREATE TABLE IF NOT EXISTS public.exotic_car_payment_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exotic_car_request_id uuid REFERENCES public.exotic_car_requests(id) ON DELETE CASCADE NOT NULL,
  quote_id uuid REFERENCES public.exotic_car_quotes(id),
  payment_status text DEFAULT 'pending',
  payment_amount numeric DEFAULT 0,
  payment_due_at timestamptz,
  payment_received_at timestamptz,
  payment_method text,
  payment_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.exotic_car_payment_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage payment tracking" ON public.exotic_car_payment_tracking FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- CREATE: exotic_car_ops_metrics_daily
-- =============================================
CREATE TABLE IF NOT EXISTS public.exotic_car_ops_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date date NOT NULL,
  city text,
  total_requests integer DEFAULT 0,
  quotes_sent integer DEFAULT 0,
  confirmed_bookings integer DEFAULT 0,
  cancellations integer DEFAULT 0,
  avg_booking_value numeric DEFAULT 0,
  upsell_revenue numeric DEFAULT 0,
  avg_partner_response_minutes numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.exotic_car_ops_metrics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view metrics" ON public.exotic_car_ops_metrics_daily FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert metrics" ON public.exotic_car_ops_metrics_daily FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_ec_requests_status ON public.exotic_car_requests(request_status);
CREATE INDEX IF NOT EXISTS idx_ec_requests_city ON public.exotic_car_requests(selected_city);
CREATE INDEX IF NOT EXISTS idx_ec_requests_urgency ON public.exotic_car_requests(urgency_level);
CREATE INDEX IF NOT EXISTS idx_ec_activity_log_request ON public.exotic_car_request_activity_log(exotic_car_request_id);
CREATE INDEX IF NOT EXISTS idx_ec_partner_offers_request ON public.exotic_car_partner_offers(exotic_car_request_id);
CREATE INDEX IF NOT EXISTS idx_ec_delivery_request ON public.exotic_car_delivery_tracking(exotic_car_request_id);
CREATE INDEX IF NOT EXISTS idx_ec_chauffeur_request ON public.exotic_car_chauffeur_assignments(exotic_car_request_id);
CREATE INDEX IF NOT EXISTS idx_ec_payment_request ON public.exotic_car_payment_tracking(exotic_car_request_id);
CREATE INDEX IF NOT EXISTS idx_ec_metrics_date ON public.exotic_car_ops_metrics_daily(metric_date);
