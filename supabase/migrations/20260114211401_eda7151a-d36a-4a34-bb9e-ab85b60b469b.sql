-- Create ambassador_notes table
CREATE TABLE public.ambassador_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wholesaler_notes table
CREATE TABLE public.wholesaler_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wholesaler_id UUID NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on ambassador_notes
ALTER TABLE public.ambassador_notes ENABLE ROW LEVEL SECURITY;

-- Enable RLS on wholesaler_notes
ALTER TABLE public.wholesaler_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for ambassador_notes
CREATE POLICY "Users can view ambassador notes" 
ON public.ambassador_notes 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create ambassador notes" 
ON public.ambassador_notes 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own ambassador notes" 
ON public.ambassador_notes 
FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own ambassador notes" 
ON public.ambassador_notes 
FOR DELETE 
USING (auth.uid() = created_by);

-- RLS policies for wholesaler_notes
CREATE POLICY "Users can view wholesaler notes" 
ON public.wholesaler_notes 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create wholesaler notes" 
ON public.wholesaler_notes 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own wholesaler notes" 
ON public.wholesaler_notes 
FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own wholesaler notes" 
ON public.wholesaler_notes 
FOR DELETE 
USING (auth.uid() = created_by);

-- Create updated_at trigger for ambassador_notes
CREATE TRIGGER update_ambassador_notes_updated_at
BEFORE UPDATE ON public.ambassador_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for wholesaler_notes
CREATE TRIGGER update_wholesaler_notes_updated_at
BEFORE UPDATE ON public.wholesaler_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();