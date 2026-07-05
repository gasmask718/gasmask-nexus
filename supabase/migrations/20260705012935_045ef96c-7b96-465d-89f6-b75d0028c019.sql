-- Phase 2: wire new Bland pathway UUIDs into dc_agents
-- Top Tier: update existing Bland outbound row
UPDATE public.dc_agents
   SET agent_id = '2c037b23-b980-47b6-9b51-046633d62847'
 WHERE id = 'c6472159-23ea-489d-bbfa-2eab0772e7e4';

-- Unforgettable Times: update existing Bland outbound row
UPDATE public.dc_agents
   SET agent_id = 'd571d8bc-43b1-4af6-812f-a94b0aff84f9'
 WHERE id = 'bc406605-a8e1-463b-bccf-097ce094ecd2';

-- Real Estate: insert new Bland outbound agent row (inactive pending E2E)
INSERT INTO public.dc_agents (
  name, agent_id, voice_id, agent_type, is_active, business, business_unit
) VALUES (
  'RE Outreach (Bland)',
  'b3375dc8-cb93-4d10-9d63-8556631a8887',
  'June',
  'outbound',
  false,
  'real_estate',
  'real_estate'
);

-- Surplus Funds: insert new Bland outbound agent row (inactive pending E2E)
INSERT INTO public.dc_agents (
  name, agent_id, voice_id, agent_type, is_active, business, business_unit
) VALUES (
  'SF Outreach (Bland)',
  'd3a5f544-bc68-4a2c-9b35-56e489b78e6d',
  'June',
  'outbound',
  false,
  'surplus_funds',
  'surplus_funds'
);

-- Playboxxx: insert new Bland outbound agent row (inactive pending E2E)
INSERT INTO public.dc_agents (
  name, agent_id, voice_id, agent_type, is_active, business, business_unit
) VALUES (
  'Playboxxx Outreach (Bland)',
  'a403b22a-3f36-4c0f-9ae5-712e8048ea44',
  'June',
  'outbound',
  false,
  'playboxxx',
  'playboxxx'
);