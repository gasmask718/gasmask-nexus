CREATE TABLE IF NOT EXISTS public.dd_product_qa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  user_id uuid,
  asker_email text,
  question text NOT NULL,
  answer text,
  answered_by text,
  answered_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','answered','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.dd_product_qa TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_product_qa TO authenticated;
GRANT ALL ON public.dd_product_qa TO service_role;

ALTER TABLE public.dd_product_qa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read answered questions"
  ON public.dd_product_qa FOR SELECT
  USING (status = 'answered');

CREATE POLICY "Anyone can submit a question"
  ON public.dd_product_qa FOR INSERT
  WITH CHECK (status = 'pending');

CREATE POLICY "Admins read all qa"
  ON public.dd_product_qa FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update qa"
  ON public.dd_product_qa FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete qa"
  ON public.dd_product_qa FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_dd_product_qa_product ON public.dd_product_qa(product_id);
CREATE INDEX IF NOT EXISTS idx_dd_product_qa_status ON public.dd_product_qa(status, created_at DESC);

CREATE TRIGGER update_dd_product_qa_updated_at
  BEFORE UPDATE ON public.dd_product_qa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();