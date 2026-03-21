-- Communication Playbooks - automated workflow engine
create table if not exists communication_playbooks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text default 'active',
  trigger_type text not null,
  trigger_config jsonb default '{}',
  conditions jsonb default '[]',
  actions jsonb default '[]',
  run_count integer default 0,
  last_triggered_at timestamptz,
  last_run_result text,
  require_approval boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Playbook execution log
create table if not exists playbook_executions (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid references communication_playbooks(id) on delete cascade,
  triggered_by text,
  trigger_data jsonb,
  conditions_passed boolean default true,
  conditions_failed jsonb default '[]',
  actions_executed jsonb default '[]',
  actions_failed jsonb default '[]',
  status text default 'completed',
  started_at timestamptz default now(),
  completed_at timestamptz,
  error_message text,
  store_id uuid,
  lead_id uuid
);

-- Enable RLS
alter table communication_playbooks enable row level security;
alter table playbook_executions enable row level security;

-- Allow authenticated users full access
create policy "Authenticated users can manage playbooks"
  on communication_playbooks for all to authenticated using (true) with check (true);

create policy "Authenticated users can manage playbook executions"
  on playbook_executions for all to authenticated using (true) with check (true);