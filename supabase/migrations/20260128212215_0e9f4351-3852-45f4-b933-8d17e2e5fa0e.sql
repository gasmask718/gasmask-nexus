-- Create influencer_assignments table for ambassador portfolio management
CREATE TABLE IF NOT EXISTS public.influencer_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
    influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
    assignment_type TEXT NOT NULL DEFAULT 'sourced' CHECK (assignment_type IN ('assigned', 'sourced', 'referred')),
    active BOOLEAN NOT NULL DEFAULT true,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    unassigned_at TIMESTAMP WITH TIME ZONE,
    unassigned_by UUID REFERENCES auth.users(id),
    notes TEXT,
    UNIQUE(ambassador_id, influencer_id)
);

-- Enable RLS
ALTER TABLE public.influencer_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for influencer_assignments
CREATE POLICY "Ambassadors can view their influencer assignments"
ON public.influencer_assignments FOR SELECT
USING (
    ambassador_id IN (
        SELECT id FROM public.ambassadors WHERE user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
);

CREATE POLICY "Ambassadors can update their influencer assignments"
ON public.influencer_assignments FOR UPDATE
USING (
    ambassador_id IN (
        SELECT id FROM public.ambassadors WHERE user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
);

CREATE POLICY "Admins can insert influencer assignments"
ON public.influencer_assignments FOR INSERT
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
    OR
    ambassador_id IN (SELECT id FROM public.ambassadors WHERE user_id = auth.uid())
);

-- Create index for performance
CREATE INDEX idx_influencer_assignments_ambassador ON public.influencer_assignments(ambassador_id) WHERE active = true;
CREATE INDEX idx_influencer_assignments_influencer ON public.influencer_assignments(influencer_id);

-- Add recruited_by_ambassador_id to ambassadors table for tracking ambassador recruits
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ambassadors' 
                   AND column_name = 'recruited_by_ambassador_id') THEN
        ALTER TABLE public.ambassadors 
        ADD COLUMN recruited_by_ambassador_id UUID REFERENCES public.ambassadors(id);
    END IF;
END $$;