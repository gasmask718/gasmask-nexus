-- Add POD Worker Role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'pod_worker';