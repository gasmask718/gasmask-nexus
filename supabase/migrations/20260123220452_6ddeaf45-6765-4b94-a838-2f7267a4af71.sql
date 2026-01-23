-- Create enum for inbound route types
CREATE TYPE public.inbound_route_type AS ENUM ('user', 'role', 'voicemail');

-- Create inbound_call_routes table
CREATE TABLE public.inbound_call_routes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    phone_number_id UUID REFERENCES public.business_phone_numbers(id) ON DELETE CASCADE,
    route_type public.inbound_route_type NOT NULL DEFAULT 'voicemail',
    route_target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    route_target_role TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Ensure only one default route per business
    CONSTRAINT unique_business_default UNIQUE (business_id, is_default) 
        DEFERRABLE INITIALLY DEFERRED
);

-- Create index for efficient lookups
CREATE INDEX idx_inbound_routes_business ON public.inbound_call_routes(business_id);
CREATE INDEX idx_inbound_routes_phone ON public.inbound_call_routes(phone_number_id);
CREATE INDEX idx_inbound_routes_active ON public.inbound_call_routes(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.inbound_call_routes ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can view routes
CREATE POLICY "Admins can view inbound routes"
ON public.inbound_call_routes
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.primary_role IN ('admin', 'owner', 'va')
    )
);

-- RLS: Only admins can insert routes
CREATE POLICY "Admins can insert inbound routes"
ON public.inbound_call_routes
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.primary_role IN ('admin', 'owner', 'va')
    )
);

-- RLS: Only admins can update routes
CREATE POLICY "Admins can update inbound routes"
ON public.inbound_call_routes
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.primary_role IN ('admin', 'owner', 'va')
    )
);

-- RLS: Only admins can delete routes
CREATE POLICY "Admins can delete inbound routes"
ON public.inbound_call_routes
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.primary_role IN ('admin', 'owner', 'va')
    )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_inbound_routes_updated_at
BEFORE UPDATE ON public.inbound_call_routes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to ensure only one default per business
CREATE OR REPLACE FUNCTION public.ensure_single_default_route()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting this route as default, unset others for the same business
    IF NEW.is_default = true THEN
        UPDATE public.inbound_call_routes
        SET is_default = false
        WHERE business_id = NEW.business_id
        AND id != NEW.id
        AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply trigger
CREATE TRIGGER ensure_single_default_route_trigger
BEFORE INSERT OR UPDATE ON public.inbound_call_routes
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_route();