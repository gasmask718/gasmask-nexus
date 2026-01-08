-- Create enum for CRM access roles
CREATE TYPE public.crm_access_role AS ENUM ('view', 'edit', 'admin');

-- Create table for CRM access mapping (user to CRM with role)
CREATE TABLE public.crm_user_access (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    crm_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    access_role crm_access_role NOT NULL DEFAULT 'view',
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    UNIQUE(user_id, crm_id)
);

-- Enable RLS
ALTER TABLE public.crm_user_access ENABLE ROW LEVEL SECURITY;

-- Create table for CRM invitations
CREATE TABLE public.crm_invitations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    invite_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by_user_id UUID REFERENCES auth.users(id),
    notes TEXT
);

-- Enable RLS
ALTER TABLE public.crm_invitations ENABLE ROW LEVEL SECURITY;

-- Create table for invitation CRM assignments (what CRMs and roles)
CREATE TABLE public.crm_invitation_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    invitation_id UUID NOT NULL REFERENCES public.crm_invitations(id) ON DELETE CASCADE,
    crm_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    access_role crm_access_role NOT NULL DEFAULT 'view',
    UNIQUE(invitation_id, crm_id)
);

-- Enable RLS
ALTER TABLE public.crm_invitation_assignments ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_crm_user_access_user ON public.crm_user_access(user_id) WHERE is_active = true;
CREATE INDEX idx_crm_user_access_crm ON public.crm_user_access(crm_id) WHERE is_active = true;
CREATE INDEX idx_crm_invitations_email ON public.crm_invitations(email) WHERE status = 'pending';
CREATE INDEX idx_crm_invitations_token ON public.crm_invitations(invite_token) WHERE status = 'pending';

-- RLS Policies for crm_user_access
-- Users can view their own access
CREATE POLICY "Users can view their own CRM access"
ON public.crm_user_access
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all access records
CREATE POLICY "Admins can view all CRM access"
ON public.crm_user_access
FOR SELECT
USING (public.is_admin(auth.uid()) OR public.is_owner(auth.uid()));

-- Admins can insert access records
CREATE POLICY "Admins can grant CRM access"
ON public.crm_user_access
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()) OR public.is_owner(auth.uid()));

-- Admins can update access records
CREATE POLICY "Admins can update CRM access"
ON public.crm_user_access
FOR UPDATE
USING (public.is_admin(auth.uid()) OR public.is_owner(auth.uid()));

-- RLS Policies for crm_invitations
-- Admins can view all invitations
CREATE POLICY "Admins can view all invitations"
ON public.crm_invitations
FOR SELECT
USING (public.is_admin(auth.uid()) OR public.is_owner(auth.uid()) OR invited_by = auth.uid());

-- Admins can create invitations
CREATE POLICY "Admins can create invitations"
ON public.crm_invitations
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()) OR public.is_owner(auth.uid()));

-- Admins can update invitations
CREATE POLICY "Admins can update invitations"
ON public.crm_invitations
FOR UPDATE
USING (public.is_admin(auth.uid()) OR public.is_owner(auth.uid()) OR invited_by = auth.uid());

-- RLS Policies for crm_invitation_assignments
-- Admins can view all assignments
CREATE POLICY "Admins can view invitation assignments"
ON public.crm_invitation_assignments
FOR SELECT
USING (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid()) 
    OR EXISTS (
        SELECT 1 FROM public.crm_invitations ci 
        WHERE ci.id = invitation_id AND ci.invited_by = auth.uid()
    )
);

-- Admins can create assignments
CREATE POLICY "Admins can create invitation assignments"
ON public.crm_invitation_assignments
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()) OR public.is_owner(auth.uid()));

-- Admins can delete assignments
CREATE POLICY "Admins can delete invitation assignments"
ON public.crm_invitation_assignments
FOR DELETE
USING (public.is_admin(auth.uid()) OR public.is_owner(auth.uid()));

-- Function to check if user can access a specific CRM
CREATE OR REPLACE FUNCTION public.can_access_crm(_user_id uuid, _crm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.is_admin(_user_id) OR public.is_owner(_user_id) OR EXISTS (
        SELECT 1 FROM public.crm_user_access
        WHERE user_id = _user_id 
        AND crm_id = _crm_id 
        AND is_active = true
        AND revoked_at IS NULL
    )
$$;

-- Function to check if user can edit a specific CRM
CREATE OR REPLACE FUNCTION public.can_edit_crm(_user_id uuid, _crm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.is_admin(_user_id) OR public.is_owner(_user_id) OR EXISTS (
        SELECT 1 FROM public.crm_user_access
        WHERE user_id = _user_id 
        AND crm_id = _crm_id 
        AND access_role IN ('edit', 'admin')
        AND is_active = true
        AND revoked_at IS NULL
    )
$$;

-- Function to check if user is CRM admin
CREATE OR REPLACE FUNCTION public.is_crm_admin(_user_id uuid, _crm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.is_admin(_user_id) OR public.is_owner(_user_id) OR EXISTS (
        SELECT 1 FROM public.crm_user_access
        WHERE user_id = _user_id 
        AND crm_id = _crm_id 
        AND access_role = 'admin'
        AND is_active = true
        AND revoked_at IS NULL
    )
$$;