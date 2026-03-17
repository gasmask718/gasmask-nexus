
CREATE TABLE IF NOT EXISTS public.brandaro_framework_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_name text NOT NULL,
  personality_id text,
  times_used integer DEFAULT 0,
  times_closed integer DEFAULT 0,
  close_rate numeric GENERATED ALWAYS AS (CASE WHEN times_used > 0 THEN (times_closed::numeric / times_used) * 100 ELSE 0 END) STORED,
  total_revenue numeric DEFAULT 0,
  avg_revenue_per_close numeric GENERATED ALWAYS AS (CASE WHEN times_closed > 0 THEN total_revenue / times_closed ELSE 0 END) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(framework_name, personality_id)
);
