
-- communication_logs additions
ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS call_type text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS answered_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS bland_call_id text,
  ADD COLUMN IF NOT EXISTS twilio_call_sid text,
  ADD COLUMN IF NOT EXISTS script_template_id uuid,
  ADD COLUMN IF NOT EXISTS call_objective text,
  ADD COLUMN IF NOT EXISTS transcript_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sentiment text,
  ADD COLUMN IF NOT EXISTS action_items jsonb,
  ADD COLUMN IF NOT EXISTS voice_persona_used text,
  ADD COLUMN IF NOT EXISTS order_intent boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_comm_logs_bland_call_id ON public.communication_logs(bland_call_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_twilio_call_sid ON public.communication_logs(twilio_call_sid);
CREATE INDEX IF NOT EXISTS idx_comm_logs_ambassador ON public.communication_logs(ambassador_id, created_at DESC);

-- ambassadors additions
ALTER TABLE public.ambassadors
  ADD COLUMN IF NOT EXISTS personal_phone text,
  ADD COLUMN IF NOT EXISTS ai_call_hourly_limit integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS ai_call_daily_limit integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS ai_call_daily_cost_cap numeric NOT NULL DEFAULT 100;

-- ambassador_call_scripts
CREATE TABLE IF NOT EXISTS public.ambassador_call_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid,
  name text NOT NULL,
  objective text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  script_body text NOT NULL,
  opening_line text,
  key_questions jsonb DEFAULT '[]'::jsonb,
  success_criteria text,
  voice_persona_id text NOT NULL DEFAULT '358e79c7-fc23-4494-8c89-21d489253bef',
  max_duration_seconds int NOT NULL DEFAULT 240,
  is_global boolean NOT NULL DEFAULT false,
  usage_count int NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ambassador_call_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scripts_select" ON public.ambassador_call_scripts;
CREATE POLICY "scripts_select" ON public.ambassador_call_scripts FOR SELECT
TO authenticated
USING (
  is_global = true
  OR ambassador_id IN (SELECT id FROM public.ambassadors WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "scripts_insert" ON public.ambassador_call_scripts;
CREATE POLICY "scripts_insert" ON public.ambassador_call_scripts FOR INSERT
TO authenticated
WITH CHECK (
  (ambassador_id IN (SELECT id FROM public.ambassadors WHERE user_id = auth.uid()) AND is_global = false)
  OR has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "scripts_update" ON public.ambassador_call_scripts;
CREATE POLICY "scripts_update" ON public.ambassador_call_scripts FOR UPDATE
TO authenticated
USING (
  ambassador_id IN (SELECT id FROM public.ambassadors WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "scripts_delete" ON public.ambassador_call_scripts;
CREATE POLICY "scripts_delete" ON public.ambassador_call_scripts FOR DELETE
TO authenticated
USING (
  ambassador_id IN (SELECT id FROM public.ambassadors WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Seed 6 starter global scripts
INSERT INTO public.ambassador_call_scripts (name, objective, language, opening_line, script_body, key_questions, success_criteria, is_global, voice_persona_id, max_duration_seconds)
SELECT * FROM (VALUES
  (
    'Re-Order Check (EN)', 'reorder_check', 'en',
    'Hi {{owner_name}}, this is Sara calling on behalf of {{ambassador_name}} from GasMask. I''m checking in — it has been {{days_since_last_order}} days since your last order.',
    'You are Sara, a friendly wholesale rep for GasMask calling {{store_name}} on behalf of ambassador {{ambassador_name}}. Greet the owner ({{owner_name}}) warmly, mention it has been {{days_since_last_order}} days since their last order. Ask if they need a restock, what specific products are running low (especially {{top_product}}), and the best day this week for delivery. Be concise, friendly, and confirm any commitments out loud before ending the call.',
    '["Do you need a restock?", "Any specific products running low?", "Best day for delivery this week?"]'::jsonb,
    'Owner confirms a restock order with a delivery day OR explicitly defers with a callback date.',
    true, '358e79c7-fc23-4494-8c89-21d489253bef', 240
  ),
  (
    'Re-Order Check (AR)', 'reorder_check', 'ar',
    'مرحبا {{owner_name}}, أنا سارة من فريق {{ambassador_name}} في GasMask. مر {{days_since_last_order}} يوما على آخر طلب لكم.',
    'أنت سارة، مندوبة جملة ودودة من GasMask تتصل بـ {{store_name}} نيابة عن {{ambassador_name}}. حيي المالك ({{owner_name}}) باحترام، اذكر أنه مر {{days_since_last_order}} يوما على آخر طلب. اسأل إذا كانوا بحاجة إلى إعادة تخزين، وما المنتجات التي على وشك النفاد (خاصة {{top_product}})، وأفضل يوم للتوصيل هذا الأسبوع. كن موجزا وودودا وأكد أي التزامات قبل إنهاء المكالمة.',
    '["هل تحتاج إعادة تخزين؟", "أي منتجات تنفد؟", "أفضل يوم للتوصيل؟"]'::jsonb,
    'يؤكد المالك طلب إعادة تخزين مع يوم تسليم أو يحدد موعد اتصال لاحق.',
    true, '358e79c7-fc23-4494-8c89-21d489253bef', 240
  ),
  (
    'Payment Reminder (EN)', 'payment_reminder', 'en',
    'Hi {{owner_name}}, courtesy call from GasMask. Just a friendly reminder you have an outstanding balance of {{outstanding_balance}}.',
    'You are Sara from GasMask making a polite payment reminder call to {{store_name}}. Greet {{owner_name}} warmly. Mention the outstanding balance of {{outstanding_balance}}. Offer to add it onto their next delivery so it''s easy to handle. Never be aggressive. Confirm next steps clearly before ending.',
    '["Can we add it to your next delivery?", "Any questions about the balance?", "When is best to collect?"]'::jsonb,
    'Owner agrees to a payment plan or commits to a specific pay date.',
    true, '358e79c7-fc23-4494-8c89-21d489253bef', 180
  ),
  (
    'Payment Reminder (AR)', 'payment_reminder', 'ar',
    'مرحبا {{owner_name}}, مكالمة تذكير ودية من GasMask بشأن رصيد مستحق قدره {{outstanding_balance}}.',
    'أنت سارة من GasMask تجري مكالمة تذكير ودية لدفع رصيد {{store_name}}. حيي {{owner_name}} باحترام، اذكر الرصيد المستحق {{outstanding_balance}}، اعرض إضافته إلى التوصيل التالي. لا تكن عدوانيا. أكد الخطوات التالية بوضوح قبل الإنهاء.',
    '["هل نضيفها للتوصيل القادم؟", "أي أسئلة عن الرصيد؟", "متى أفضل وقت للتحصيل؟"]'::jsonb,
    'يوافق المالك على خطة دفع أو يلتزم بتاريخ محدد.',
    true, '358e79c7-fc23-4494-8c89-21d489253bef', 180
  ),
  (
    'Re-Engagement (EN)', 'reengagement', 'en',
    'Hi {{owner_name}}, this is Sara from GasMask — we miss having {{store_name}} as an active customer. I have a special offer just for you.',
    'You are Sara from GasMask reaching out to a lapsed customer ({{store_name}}). Last order was {{last_order_date}}. Warmly reconnect, ask how business is going, and offer a special re-engagement discount on their next order. Listen for any objections (price, supply, switched suppliers) and address them.',
    '["How has business been?", "What''s held you back from ordering?", "Would a special discount help bring you back?"]'::jsonb,
    'Owner places a new order or commits to a specific date to do so.',
    true, '358e79c7-fc23-4494-8c89-21d489253bef', 300
  ),
  (
    'New Product Pitch (EN)', 'new_product_pitch', 'en',
    'Hi {{owner_name}}, Sara here from GasMask — excited to tell you about our new {{new_product}} with a {{discount}} launch discount.',
    'You are Sara from GasMask pitching a new product to {{store_name}}. Introduce {{new_product}} with a {{discount}} launch discount. Explain why it sells well in their type of store, suggest a starter quantity, and offer to add it onto their next delivery. Be enthusiastic but not pushy.',
    '["Have you tried {{new_product}} before?", "Would you like to start with a small case?", "Can we add it to your next delivery?"]'::jsonb,
    'Owner agrees to try the new product on next delivery.',
    true, '358e79c7-fc23-4494-8c89-21d489253bef', 240
  )
) AS v(name, objective, language, opening_line, script_body, key_questions, success_criteria, is_global, voice_persona_id, max_duration_seconds)
WHERE NOT EXISTS (SELECT 1 FROM public.ambassador_call_scripts WHERE is_global = true);

-- Touch trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_acs_updated ON public.ambassador_call_scripts;
CREATE TRIGGER trg_acs_updated BEFORE UPDATE ON public.ambassador_call_scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
