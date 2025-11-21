-- Create drivers_live_location table for real-time tracking
CREATE TABLE public.drivers_live_location (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(driver_id)
);

-- Enable RLS
ALTER TABLE public.drivers_live_location ENABLE ROW LEVEL SECURITY;

-- Anyone can view driver locations
CREATE POLICY "Anyone can view driver locations"
ON public.drivers_live_location
FOR SELECT
USING (true);

-- Drivers can update their own location
CREATE POLICY "Drivers can update own location"
ON public.drivers_live_location
FOR ALL
USING (auth.uid() = driver_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers_live_location;

-- Create function to auto-update timestamp
CREATE OR REPLACE FUNCTION public.update_drivers_location_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_drivers_location_timestamp
BEFORE UPDATE ON public.drivers_live_location
FOR EACH ROW
EXECUTE FUNCTION public.update_drivers_location_timestamp();