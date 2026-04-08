
-- =============================================
-- NEW TABLE: venue_quote_actions
-- =============================================
CREATE TABLE IF NOT EXISTS public.venue_quote_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.virtual_tour_quotes(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.virtual_tour_requests(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('viewed', 'revision_requested', 'question_submitted', 'estimate_requested', 'approved', 'declined', 'expired', 'sent', 'updated', 'locked', 'reopened')),
  action_notes TEXT,
  actor_type TEXT NOT NULL DEFAULT 'admin' CHECK (actor_type IN ('venue', 'admin', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.venue_quote_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage venue_quote_actions" ON public.venue_quote_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_vqa_quote ON public.venue_quote_actions(quote_id);
CREATE INDEX idx_vqa_request ON public.venue_quote_actions(request_id);

-- =============================================
-- NEW TABLE: venue_quote_revisions
-- =============================================
CREATE TABLE IF NOT EXISTS public.venue_quote_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.virtual_tour_quotes(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.virtual_tour_requests(id) ON DELETE CASCADE,
  revision_type TEXT,
  requested_changes TEXT,
  admin_response TEXT,
  revision_status TEXT NOT NULL DEFAULT 'pending' CHECK (revision_status IN ('pending', 'reviewed', 'updated', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

ALTER TABLE public.venue_quote_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage venue_quote_revisions" ON public.venue_quote_revisions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_vqr_quote ON public.venue_quote_revisions(quote_id);

-- =============================================
-- NEW TABLE: shoot_date_options
-- =============================================
CREATE TABLE IF NOT EXISTS public.shoot_date_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.virtual_tour_requests(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.virtual_tour_quotes(id),
  photographer_id UUID REFERENCES public.photographers(id),
  option_date DATE NOT NULL,
  option_start_time TIME,
  option_end_time TIME,
  option_status TEXT NOT NULL DEFAULT 'proposed' CHECK (option_status IN ('proposed', 'selected', 'expired', 'unavailable')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shoot_date_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage shoot_date_options" ON public.shoot_date_options FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_sdo_request ON public.shoot_date_options(request_id);
CREATE INDEX idx_sdo_photographer ON public.shoot_date_options(photographer_id);

-- =============================================
-- NEW TABLE: locked_shoot_bookings
-- =============================================
CREATE TABLE IF NOT EXISTS public.locked_shoot_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.virtual_tour_requests(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.virtual_tour_quotes(id),
  photographer_id UUID NOT NULL REFERENCES public.photographers(id),
  locked_date DATE NOT NULL,
  locked_start_time TIME,
  locked_end_time TIME,
  booking_status TEXT NOT NULL DEFAULT 'pending_confirmation' CHECK (booking_status IN ('pending_confirmation', 'locked', 'scheduled', 'completed', 'cancelled', 'reschedule_requested')),
  venue_confirmed_at TIMESTAMPTZ,
  admin_confirmed_at TIMESTAMPTZ,
  photographer_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.locked_shoot_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage locked_shoot_bookings" ON public.locked_shoot_bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_lsb_request ON public.locked_shoot_bookings(request_id);
CREATE INDEX idx_lsb_photographer ON public.locked_shoot_bookings(photographer_id);
CREATE INDEX idx_lsb_date ON public.locked_shoot_bookings(locked_date);

-- =============================================
-- EXTEND: virtual_tour_quotes
-- =============================================
ALTER TABLE public.virtual_tour_quotes
  ADD COLUMN IF NOT EXISTS quote_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_declined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_revision_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_package_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS schedule_status TEXT DEFAULT 'unscheduled',
  ADD COLUMN IF NOT EXISTS locked_booking_id UUID;

-- =============================================
-- EXTEND: virtual_tour_requests
-- =============================================
ALTER TABLE public.virtual_tour_requests
  ADD COLUMN IF NOT EXISTS venue_decision_status TEXT DEFAULT 'awaiting',
  ADD COLUMN IF NOT EXISTS preferred_shoot_date_1 DATE,
  ADD COLUMN IF NOT EXISTS preferred_shoot_date_2 DATE,
  ADD COLUMN IF NOT EXISTS preferred_shoot_date_3 DATE,
  ADD COLUMN IF NOT EXISTS booking_conversion_stage TEXT DEFAULT 'quote_pending',
  ADD COLUMN IF NOT EXISTS assigned_quote_id UUID;

-- =============================================
-- EXTEND: photographer_jobs
-- =============================================
ALTER TABLE public.photographer_jobs
  ADD COLUMN IF NOT EXISTS scheduled_start_time TIME,
  ADD COLUMN IF NOT EXISTS scheduled_end_time TIME,
  ADD COLUMN IF NOT EXISTS venue_approved_quote_id UUID,
  ADD COLUMN IF NOT EXISTS booking_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reschedule_status TEXT;
