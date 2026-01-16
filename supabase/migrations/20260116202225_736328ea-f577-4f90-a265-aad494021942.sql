-- Create company_notes table
CREATE TABLE IF NOT EXISTS public.company_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create biker_notes table
CREATE TABLE IF NOT EXISTS public.biker_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  biker_id UUID NOT NULL REFERENCES public.bikers(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.company_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biker_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for company_notes
CREATE POLICY "Authenticated users can view company notes" ON public.company_notes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create company notes" ON public.company_notes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own company notes" ON public.company_notes
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own company notes" ON public.company_notes
  FOR DELETE USING (auth.uid() = created_by);

-- Create RLS policies for biker_notes
CREATE POLICY "Authenticated users can view biker notes" ON public.biker_notes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create biker notes" ON public.biker_notes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own biker notes" ON public.biker_notes
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own biker notes" ON public.biker_notes
  FOR DELETE USING (auth.uid() = created_by);

-- Create indexes for better performance
CREATE INDEX idx_company_notes_company_id ON public.company_notes(company_id);
CREATE INDEX idx_biker_notes_biker_id ON public.biker_notes(biker_id);

-- Create updated_at triggers
CREATE TRIGGER update_company_notes_updated_at
  BEFORE UPDATE ON public.company_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_biker_notes_updated_at
  BEFORE UPDATE ON public.biker_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();