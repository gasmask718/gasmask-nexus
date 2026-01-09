-- Add created_by column to wholesalers table
ALTER TABLE public.wholesalers
ADD COLUMN created_by UUID REFERENCES auth.users(id);