-- ===============================================
-- UNFORGETTABLE TIMES: Events, Payments, Documents
-- Tabs are views into data, not decorations.
-- If a tab doesn't query by staff ID, it is broken.
-- ===============================================

-- 1. Create ut_events table (core event data)
CREATE TABLE IF NOT EXISTS public.ut_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_slug TEXT NOT NULL DEFAULT 'unforgettable_times_usa',
  event_name TEXT NOT NULL,
  event_type TEXT, -- birthday, wedding, corporate, etc.
  venue_name TEXT,
  venue_address TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  client_name TEXT,
  client_phone TEXT,
  client_email TEXT,
  notes TEXT,
  total_staff_needed INTEGER DEFAULT 1,
  total_revenue NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

-- 2. Create ut_event_staff junction table (links events to staff)
CREATE TABLE IF NOT EXISTS public.ut_event_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.ut_events(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.ut_staff(id) ON DELETE CASCADE,
  role_at_event TEXT, -- their role for this specific event
  scheduled_start TIME,
  scheduled_end TIME,
  actual_check_in TIMESTAMPTZ,
  actual_check_out TIMESTAMPTZ,
  hours_worked NUMERIC(5,2),
  pay_rate_applied NUMERIC(10,2),
  amount_earned NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'confirmed', 'checked_in', 'completed', 'no_show', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, staff_id)
);

-- 3. Create ut_staff_payments table (payment ledger per staff member)
CREATE TABLE IF NOT EXISTS public.ut_staff_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.ut_staff(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.ut_events(id) ON DELETE SET NULL,
  event_staff_id UUID REFERENCES public.ut_event_staff(id) ON DELETE SET NULL,
  business_slug TEXT NOT NULL DEFAULT 'unforgettable_times_usa',
  payment_date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'event' CHECK (payment_type IN ('event', 'bonus', 'advance', 'reimbursement', 'adjustment', 'other')),
  payment_method TEXT CHECK (payment_method IN ('cash', 'check', 'direct_deposit', 'venmo', 'zelle', 'paypal', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  reference_number TEXT, -- check number, transaction ID, etc.
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 4. Create ut_staff_documents table (staff-specific documents)
CREATE TABLE IF NOT EXISTS public.ut_staff_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.ut_staff(id) ON DELETE CASCADE,
  business_slug TEXT NOT NULL DEFAULT 'unforgettable_times_usa',
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('contract', 'id', 'certification', 'agreement', 'tax_form', 'background_check', 'other')),
  file_url TEXT,
  file_size INTEGER, -- in bytes
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiry_date DATE, -- for certifications, IDs, etc.
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'archived', 'pending_review')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id)
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ut_events_date ON public.ut_events(event_date);
CREATE INDEX IF NOT EXISTS idx_ut_events_status ON public.ut_events(status);
CREATE INDEX IF NOT EXISTS idx_ut_events_business ON public.ut_events(business_slug);

CREATE INDEX IF NOT EXISTS idx_ut_event_staff_event ON public.ut_event_staff(event_id);
CREATE INDEX IF NOT EXISTS idx_ut_event_staff_staff ON public.ut_event_staff(staff_id);
CREATE INDEX IF NOT EXISTS idx_ut_event_staff_status ON public.ut_event_staff(status);

CREATE INDEX IF NOT EXISTS idx_ut_staff_payments_staff ON public.ut_staff_payments(staff_id);
CREATE INDEX IF NOT EXISTS idx_ut_staff_payments_date ON public.ut_staff_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_ut_staff_payments_status ON public.ut_staff_payments(status);

CREATE INDEX IF NOT EXISTS idx_ut_staff_documents_staff ON public.ut_staff_documents(staff_id);
CREATE INDEX IF NOT EXISTS idx_ut_staff_documents_type ON public.ut_staff_documents(document_type);

-- 6. Enable RLS
ALTER TABLE public.ut_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_event_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_staff_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_staff_documents ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies - Allow authenticated users full access (scope by business_slug in application)
CREATE POLICY "ut_events_select" ON public.ut_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "ut_events_insert" ON public.ut_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ut_events_update" ON public.ut_events FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ut_events_delete" ON public.ut_events FOR DELETE TO authenticated USING (true);

CREATE POLICY "ut_event_staff_select" ON public.ut_event_staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "ut_event_staff_insert" ON public.ut_event_staff FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ut_event_staff_update" ON public.ut_event_staff FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ut_event_staff_delete" ON public.ut_event_staff FOR DELETE TO authenticated USING (true);

CREATE POLICY "ut_staff_payments_select" ON public.ut_staff_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "ut_staff_payments_insert" ON public.ut_staff_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ut_staff_payments_update" ON public.ut_staff_payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ut_staff_payments_delete" ON public.ut_staff_payments FOR DELETE TO authenticated USING (true);

CREATE POLICY "ut_staff_documents_select" ON public.ut_staff_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "ut_staff_documents_insert" ON public.ut_staff_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ut_staff_documents_update" ON public.ut_staff_documents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ut_staff_documents_delete" ON public.ut_staff_documents FOR DELETE TO authenticated USING (true);

-- 8. Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION public.ut_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER ut_events_updated_at BEFORE UPDATE ON public.ut_events
  FOR EACH ROW EXECUTE FUNCTION public.ut_update_timestamp();

CREATE TRIGGER ut_event_staff_updated_at BEFORE UPDATE ON public.ut_event_staff
  FOR EACH ROW EXECUTE FUNCTION public.ut_update_timestamp();

CREATE TRIGGER ut_staff_payments_updated_at BEFORE UPDATE ON public.ut_staff_payments
  FOR EACH ROW EXECUTE FUNCTION public.ut_update_timestamp();

CREATE TRIGGER ut_staff_documents_updated_at BEFORE UPDATE ON public.ut_staff_documents
  FOR EACH ROW EXECUTE FUNCTION public.ut_update_timestamp();

-- 9. Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.ut_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ut_event_staff;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ut_staff_payments;