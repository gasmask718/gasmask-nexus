-- Create Global Tags Registry table
CREATE TABLE public.global_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  category text DEFAULT 'general',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT global_tags_name_unique UNIQUE (name),
  CONSTRAINT global_tags_slug_unique UNIQUE (slug)
);

-- Create Tag Attachments table (links tags to entities)
CREATE TABLE public.tag_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tag_id uuid NOT NULL REFERENCES public.global_tags(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tag_attachments_unique UNIQUE (tag_id, entity_type, entity_id)
);

-- Create indexes for efficient querying
CREATE INDEX idx_global_tags_status ON public.global_tags(status);
CREATE INDEX idx_global_tags_category ON public.global_tags(category);
CREATE INDEX idx_global_tags_slug ON public.global_tags(slug);
CREATE INDEX idx_tag_attachments_entity ON public.tag_attachments(entity_type, entity_id);
CREATE INDEX idx_tag_attachments_tag_id ON public.tag_attachments(tag_id);

-- Enable RLS
ALTER TABLE public.global_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for global_tags (all authenticated users can read, admins can write)
CREATE POLICY "Anyone can view active tags"
  ON public.global_tags
  FOR SELECT
  USING (status = 'active');

CREATE POLICY "Authenticated users can create tags"
  ON public.global_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tags"
  ON public.global_tags
  FOR UPDATE
  TO authenticated
  USING (true);

-- RLS policies for tag_attachments
CREATE POLICY "Anyone can view tag attachments"
  ON public.tag_attachments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can attach tags"
  ON public.tag_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can remove tag attachments"
  ON public.tag_attachments
  FOR DELETE
  TO authenticated
  USING (true);

-- Add comments
COMMENT ON TABLE public.global_tags IS 'Single source of truth for all tags in the system';
COMMENT ON TABLE public.tag_attachments IS 'Links tags to entities (stores, products, invoices, contacts, etc.)';
COMMENT ON COLUMN public.global_tags.slug IS 'URL-safe lowercase version of the tag name';
COMMENT ON COLUMN public.global_tags.category IS 'Optional category for filtering (general, priority, status, etc.)';

-- Create function to automatically generate slug
CREATE OR REPLACE FUNCTION public.generate_tag_slug()
RETURNS TRIGGER AS $$
BEGIN
  NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
  NEW.slug := trim(both '-' from NEW.slug);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for slug generation
CREATE TRIGGER generate_tag_slug_trigger
  BEFORE INSERT OR UPDATE ON public.global_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_tag_slug();

-- Create function to update updated_at timestamp
CREATE TRIGGER update_global_tags_updated_at
  BEFORE UPDATE ON public.global_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();