-- Add missing columns to companies table (only if they don't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'neighborhood') THEN
    ALTER TABLE companies ADD COLUMN neighborhood text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'boro') THEN
    ALTER TABLE companies ADD COLUMN boro text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'sells_flowers') THEN
    ALTER TABLE companies ADD COLUMN sells_flowers boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'rpa_status') THEN
    ALTER TABLE companies ADD COLUMN rpa_status text DEFAULT 'not_needed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'payment_reliability_score') THEN
    ALTER TABLE companies ADD COLUMN payment_reliability_score integer DEFAULT 50;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'payment_reliability_tier') THEN
    ALTER TABLE companies ADD COLUMN payment_reliability_tier text DEFAULT 'middle';
  END IF;
END $$;

-- Add invoice_id to store_payments if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_payments' AND column_name = 'invoice_id') THEN
    ALTER TABLE store_payments ADD COLUMN invoice_id uuid REFERENCES invoices(id);
  END IF;
END $$;