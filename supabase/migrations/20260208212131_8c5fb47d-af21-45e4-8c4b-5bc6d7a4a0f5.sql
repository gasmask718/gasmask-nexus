
-- Statement Imports table for tracking uploaded bank/credit statements
CREATE TABLE public.statement_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by UUID REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT DEFAULT 'csv',
  account_label TEXT,
  statement_month TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'categorized', 'approved', 'rejected')),
  total_transactions INTEGER DEFAULT 0,
  total_debits NUMERIC(12,2) DEFAULT 0,
  total_credits NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Parsed transactions from statement imports
CREATE TABLE public.statement_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID NOT NULL REFERENCES public.statement_imports(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  original_category TEXT,
  suggested_category TEXT,
  final_category TEXT,
  vendor_match TEXT,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for statement_imports
CREATE POLICY "Users can view statement imports"
  ON public.statement_imports FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert statement imports"
  ON public.statement_imports FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update statement imports"
  ON public.statement_imports FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- RLS policies for statement_transactions
CREATE POLICY "Users can view statement transactions"
  ON public.statement_transactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert statement transactions"
  ON public.statement_transactions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update statement transactions"
  ON public.statement_transactions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX idx_statement_imports_status ON public.statement_imports(status);
CREATE INDEX idx_statement_transactions_import ON public.statement_transactions(import_id);
CREATE INDEX idx_statement_transactions_date ON public.statement_transactions(transaction_date);
