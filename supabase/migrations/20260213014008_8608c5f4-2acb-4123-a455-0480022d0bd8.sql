
-- Route Templates: saved blueprints for recurring stop sets
CREATE TABLE public.route_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  worker_type TEXT NOT NULL CHECK (worker_type IN ('driver', 'biker')),
  default_territory TEXT,
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Route Template Stops: ordered store list for a template
CREATE TABLE public.route_template_stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.route_templates(id) ON DELETE CASCADE,
  store_id UUID NOT NULL,
  default_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.route_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_template_stops ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read; creators can manage
CREATE POLICY "Authenticated users can view active templates"
  ON public.route_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create templates"
  ON public.route_templates FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators can update their templates"
  ON public.route_templates FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete their templates"
  ON public.route_templates FOR DELETE
  USING (auth.uid() = created_by);

CREATE POLICY "Authenticated users can view template stops"
  ON public.route_template_stops FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage template stops"
  ON public.route_template_stops FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update template stops"
  ON public.route_template_stops FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete template stops"
  ON public.route_template_stops FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Timestamp trigger
CREATE TRIGGER update_route_templates_updated_at
  BEFORE UPDATE ON public.route_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_route_template_stops_template_id ON public.route_template_stops(template_id);
CREATE INDEX idx_route_templates_worker_type ON public.route_templates(worker_type);
CREATE INDEX idx_route_templates_is_active ON public.route_templates(is_active);
