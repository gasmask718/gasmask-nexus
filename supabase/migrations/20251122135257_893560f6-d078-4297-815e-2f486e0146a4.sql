-- POD Designs Table
CREATE TABLE IF NOT EXISTS public.pod_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('evergreen', 'holiday', 'hot_mama', 'gasmask')),
  title TEXT NOT NULL,
  ai_description TEXT,
  tags TEXT[],
  seo_keywords TEXT[],
  design_image_url TEXT,
  mockup_urls TEXT[],
  variations_created INT DEFAULT 0,
  generated_by_ai BOOLEAN DEFAULT false,
  approved_by_va BOOLEAN DEFAULT false,
  approval_user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'queued', 'uploaded', 'performing', 'winning')),
  platforms_uploaded TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- POD Videos Table
CREATE TABLE IF NOT EXISTS public.pod_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID REFERENCES public.pod_designs(id) ON DELETE CASCADE,
  video_url TEXT,
  platform_ready_versions JSONB,
  ai_script_used TEXT,
  ai_voice_used TEXT,
  performance_metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- POD Marketplace Accounts Table
CREATE TABLE IF NOT EXISTS public.pod_marketplace_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name TEXT NOT NULL CHECK (platform_name IN ('etsy', 'amazon', 'tiktok_shop', 'redbubble', 'shopify', 'teespring', 'walmart')),
  api_key TEXT,
  connection_status TEXT DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'error')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- POD Sales Table
CREATE TABLE IF NOT EXISTS public.pod_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID REFERENCES public.pod_designs(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  sale_price DECIMAL(10,2),
  profit DECIMAL(10,2),
  order_date TIMESTAMPTZ DEFAULT now(),
  buyer_geo TEXT,
  sku TEXT
);

-- POD AI Logs Table
CREATE TABLE IF NOT EXISTS public.pod_ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pod_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_marketplace_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_ai_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pod_designs (pod_worker and admin only)
CREATE POLICY "POD workers and admins can view designs" ON public.pod_designs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('pod_worker', 'admin')
    )
  );

CREATE POLICY "POD workers and admins can insert designs" ON public.pod_designs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('pod_worker', 'admin')
    )
  );

CREATE POLICY "POD workers and admins can update designs" ON public.pod_designs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('pod_worker', 'admin')
    )
  );

CREATE POLICY "POD workers and admins can delete designs" ON public.pod_designs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('pod_worker', 'admin')
    )
  );

-- RLS Policies for pod_videos
CREATE POLICY "POD workers and admins can manage videos" ON public.pod_videos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('pod_worker', 'admin')
    )
  );

-- RLS Policies for pod_marketplace_accounts
CREATE POLICY "POD workers and admins can manage marketplace accounts" ON public.pod_marketplace_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('pod_worker', 'admin')
    )
  );

-- RLS Policies for pod_sales
CREATE POLICY "POD workers and admins can view sales" ON public.pod_sales
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('pod_worker', 'admin')
    )
  );

CREATE POLICY "POD workers and admins can insert sales" ON public.pod_sales
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('pod_worker', 'admin')
    )
  );

-- RLS Policies for pod_ai_logs
CREATE POLICY "POD workers and admins can view AI logs" ON public.pod_ai_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('pod_worker', 'admin')
    )
  );

CREATE POLICY "System can insert AI logs" ON public.pod_ai_logs
  FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pod_designs_status ON public.pod_designs(status);
CREATE INDEX IF NOT EXISTS idx_pod_designs_category ON public.pod_designs(category);
CREATE INDEX IF NOT EXISTS idx_pod_designs_created_at ON public.pod_designs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pod_sales_design_id ON public.pod_sales(design_id);
CREATE INDEX IF NOT EXISTS idx_pod_sales_order_date ON public.pod_sales(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_pod_videos_design_id ON public.pod_videos(design_id);

-- Trigger for updated_at
CREATE TRIGGER update_pod_designs_updated_at
  BEFORE UPDATE ON public.pod_designs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pod_marketplace_accounts_updated_at
  BEFORE UPDATE ON public.pod_marketplace_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();