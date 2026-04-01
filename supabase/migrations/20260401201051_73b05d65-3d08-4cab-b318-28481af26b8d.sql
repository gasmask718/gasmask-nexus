
-- Add missing columns to dc_agents
ALTER TABLE public.dc_agents ADD COLUMN IF NOT EXISTS business TEXT DEFAULT 'gasmask';
ALTER TABLE public.dc_agents ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.dc_agents ADD COLUMN IF NOT EXISTS total_minutes DECIMAL DEFAULT 0;

-- Add missing columns to dc_call_logs
ALTER TABLE public.dc_call_logs ADD COLUMN IF NOT EXISTS business TEXT;
ALTER TABLE public.dc_call_logs ADD COLUMN IF NOT EXISTS agent_name TEXT;

-- Add missing columns to dc_campaigns
ALTER TABLE public.dc_campaigns ADD COLUMN IF NOT EXISTS business TEXT DEFAULT 'gasmask';
ALTER TABLE public.dc_campaigns ADD COLUMN IF NOT EXISTS agent_id TEXT;
ALTER TABLE public.dc_campaigns ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE public.dc_campaigns ADD COLUMN IF NOT EXISTS calls_connected INTEGER DEFAULT 0;
ALTER TABLE public.dc_campaigns ADD COLUMN IF NOT EXISTS from_phone_number TEXT;
ALTER TABLE public.dc_campaigns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add missing columns to dc_leads
ALTER TABLE public.dc_leads ADD COLUMN IF NOT EXISTS business TEXT;

-- Add missing columns to dc_phone_numbers
ALTER TABLE public.dc_phone_numbers ADD COLUMN IF NOT EXISTS business TEXT;
ALTER TABLE public.dc_phone_numbers ADD COLUMN IF NOT EXISTS twilio_sid TEXT;
ALTER TABLE public.dc_phone_numbers ADD COLUMN IF NOT EXISTS elevenlabs_phone_id TEXT;
ALTER TABLE public.dc_phone_numbers ADD COLUMN IF NOT EXISTS assigned_agent_id TEXT;
ALTER TABLE public.dc_phone_numbers ADD COLUMN IF NOT EXISTS assigned_agent_name TEXT;
ALTER TABLE public.dc_phone_numbers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Insert all 19 agents
INSERT INTO public.dc_agents (name, agent_id, business, agent_type) VALUES
('UT Partner Outreach', 'agent_5201kn54728feypt0hx5e3ekqx5v', 'unforgettable_times', 'outbound'),
('UT Event Planner Concierge', 'agent_8801kn5474baemz8jrh4txqc3jpz', 'unforgettable_times', 'inbound'),
('UT Ambassador Help Line', 'agent_1601kn54769ee7xtw8qgq11qd1jv', 'unforgettable_times', 'inbound'),
('RE Lead Qualifier', 'agent_6001kn54788kfdz8pg7vkhrda8e9', 'real_estate', 'outbound'),
('RE Wholesale Specialist', 'agent_2301kn547a6afv2tregdw925by0e', 'real_estate', 'outbound'),
('RE Closer', 'agent_2701kn547c4zfd7bd4ftepnn6ycx', 'real_estate', 'outbound'),
('SF Client Outreach', 'agent_1801kn547e3xf85ryd2gn0ycc52w', 'surplus_funds', 'outbound'),
('SF Attorney Acquisition', 'agent_4201kn547h17e80vb9v6y3b0mz0n', 'surplus_funds', 'outbound'),
('TT Luxury Concierge', 'agent_4701kn547jzbe65thct7q09c7f59', 'top_tier', 'inbound'),
('TT Ambassador Help Line', 'agent_7601kn547mytf8j89x2446qb6da4', 'top_tier', 'inbound'),
('Brandaro Digital Sales Expert', 'agent_5801kn547px9f3fs95cb78nnjfee', 'brandaro', 'outbound'),
('Brandaro Sales Closer', 'agent_1101kn547rvrfnnarszessh4d3vw', 'brandaro', 'outbound'),
('Brandaro Relationship Specialist', 'agent_7001kn547vs9ebeakqc3fh6p4ya6', 'brandaro', 'outbound'),
('Brandaro Spanish Closer', 'agent_2101kn547xqheby869pypaxs28w5', 'brandaro', 'outbound'),
('Brandaro Spanish Relationship', 'agent_8301kn547zpyfv4scj3n1e3x22cb', 'brandaro', 'outbound'),
('Playboxxx Manager', 'agent_6401kn5482kwfsgtm7v9fnqbx35j', 'playboxxx', 'outbound'),
('Playboxxx Affiliate Specialist', 'agent_8201kn5484m9e9jrf5b7zqbbrykx', 'playboxxx', 'outbound'),
('Playboxxx Production Coordinator', 'agent_1801kn5487gbec1bmvbw555e97zy', 'playboxxx', 'outbound'),
('iClean Booking Agent', 'agent_2501kn5489fkfg4sy47vxsjq8yyz', 'iclean', 'inbound')
ON CONFLICT (agent_id) DO NOTHING;

-- Insert GasMask number if not exists
INSERT INTO public.dc_phone_numbers (business, phone_number, friendly_name, assigned_agent_name)
SELECT 'gasmask', '+18484004179', 'GasMask Main Line', 'Sales Introduction'
WHERE NOT EXISTS (SELECT 1 FROM public.dc_phone_numbers WHERE phone_number = '+18484004179');
