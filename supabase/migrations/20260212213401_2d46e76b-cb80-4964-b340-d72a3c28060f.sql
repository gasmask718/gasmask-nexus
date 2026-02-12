-- Add missing updated_at column to wholesalers table
ALTER TABLE public.wholesalers
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create trigger to automatically update updated_at on any modification
CREATE OR REPLACE FUNCTION public.update_wholesalers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wholesalers_update_timestamp
BEFORE UPDATE ON public.wholesalers
FOR EACH ROW
EXECUTE FUNCTION public.update_wholesalers_updated_at();