ALTER TABLE public.bland_agent_webhooks ADD COLUMN IF NOT EXISTS bland_agent_id text;

UPDATE public.bland_agent_webhooks SET bland_agent_id = 'c9dc0cd5-6dd7-4ef0-9c43-fe9a63b0f6e2' WHERE agent_type = 'follow-up';
UPDATE public.bland_agent_webhooks SET bland_agent_id = '0595f1a5-61aa-4a8e-b5a5-b68b26f6999a' WHERE agent_type = 'sales-outreach';
UPDATE public.bland_agent_webhooks SET bland_agent_id = 'd15a2752-0d05-4e38-89f8-224d43e759ba' WHERE agent_type = 'inventory-check';
UPDATE public.bland_agent_webhooks SET bland_agent_id = 'a6ae916a-7030-4607-8e82-a4c2ccc8fc85' WHERE agent_type = 'reactivation';