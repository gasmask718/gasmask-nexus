-- ============================================================
-- Add is_simulation column to key CRM tables
-- Part of Simulation Mode Implementation Plan
-- ============================================================
-- This migration adds the is_simulation flag to tables that need
-- to be separated between live and simulation data.
-- All changes use IF NOT EXISTS to make this migration idempotent.

-- 1. Add to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_companies_is_simulation 
ON public.companies(is_simulation);

-- 2. Add to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_invoices_is_simulation 
ON public.invoices(is_simulation);

-- 3. Add to wholesale_orders table
ALTER TABLE public.wholesale_orders 
ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_wholesale_orders_is_simulation 
ON public.wholesale_orders(is_simulation);

-- 4. Add to store_payments table
ALTER TABLE public.store_payments 
ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_store_payments_is_simulation 
ON public.store_payments(is_simulation);

-- 5. Add to store_contacts table
-- Note: store_contacts links to stores table, but we add is_simulation
-- for direct filtering capability
ALTER TABLE public.store_contacts 
ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_store_contacts_is_simulation 
ON public.store_contacts(is_simulation);

