-- Create driver_notes table for CRUD notes on driver profiles
CREATE TABLE public.driver_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.driver_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view driver notes"
  ON public.driver_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create driver notes"
  ON public.driver_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own driver notes"
  ON public.driver_notes FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own driver notes"
  ON public.driver_notes FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_driver_notes_updated_at
  BEFORE UPDATE ON public.driver_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_driver_notes_driver_id ON public.driver_notes(driver_id);
CREATE INDEX idx_driver_notes_is_pinned ON public.driver_notes(is_pinned);