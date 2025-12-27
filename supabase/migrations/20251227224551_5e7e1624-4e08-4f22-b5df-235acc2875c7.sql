-- Add 'va' to app_role enum - this needs to be its own transaction
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'va';