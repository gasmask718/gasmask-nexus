
-- ===========================================
-- funding_payment_cards
-- ===========================================
CREATE TABLE public.funding_payment_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_nickname text NOT NULL,
  card_brand text NOT NULL DEFAULT 'Visa',
  last4 text NOT NULL,
  available_balance numeric NOT NULL DEFAULT 0,
  billing_threshold numeric DEFAULT 100,
  is_primary boolean DEFAULT false,
  connected_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_payment_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage payment cards"
  ON public.funding_payment_cards FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ===========================================
-- funding_bills
-- ===========================================
CREATE TABLE public.funding_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_name text NOT NULL,
  vendor text,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly',
  auto_pay_enabled boolean DEFAULT false,
  payment_card_id uuid REFERENCES public.funding_payment_cards(id),
  payment_card_last4 text,
  payment_card_brand text,
  card_sufficient boolean DEFAULT true,
  status text NOT NULL DEFAULT 'upcoming',
  confirmation_number text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage bills"
  ON public.funding_bills FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ===========================================
-- deletion_letter_recipients
-- ===========================================
CREATE TABLE public.deletion_letter_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  address text,
  city text,
  state text,
  zip text,
  email text,
  phone text,
  ssn_last4 text,
  date_of_birth text,
  account_number text,
  creditor_name text,
  bureau text DEFAULT 'All Three',
  dispute_reason text,
  letter_type text NOT NULL DEFAULT 'standard_deletion',
  letter_status text NOT NULL DEFAULT 'draft',
  generated_letter text,
  generated_at timestamptz,
  sent_at timestamptz,
  -- ChexSystems fields
  is_chexsystems boolean DEFAULT false,
  chexsystems_report_date text,
  chexsystems_item_description text,
  chexsystems_reporting_bank text,
  chexsystems_amount_owed numeric,
  chexsystems_dispute_type text,
  chexsystems_letter_type text,
  chexsystems_file_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deletion_letter_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage deletion letter recipients"
  ON public.deletion_letter_recipients FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ===========================================
-- chexsystems_upload_documents
-- ===========================================
CREATE TABLE public.chexsystems_upload_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.deletion_letter_recipients(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  document_type text NOT NULL DEFAULT 'other',
  storage_path text NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chexsystems_upload_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage chexsystems documents"
  ON public.chexsystems_upload_documents FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for chexsystems documents
INSERT INTO storage.buckets (id, name, public) VALUES ('chexsystems-docs', 'chexsystems-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload chexsystems docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chexsystems-docs');

CREATE POLICY "Authenticated users can view chexsystems docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chexsystems-docs');

CREATE POLICY "Authenticated users can delete chexsystems docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chexsystems-docs');
