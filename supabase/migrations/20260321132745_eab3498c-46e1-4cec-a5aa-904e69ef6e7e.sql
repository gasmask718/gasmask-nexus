
create table if not exists public.message_send_queue (
  id uuid primary key default gen_random_uuid(),
  campaign_name text,
  audience_type text,
  message_body text not null,
  total_recipients integer default 0,
  sent_count integer default 0,
  delivered_count integer default 0,
  failed_count integer default 0,
  replied_count integer default 0,
  status text default 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.message_send_queue_items (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references public.message_send_queue(id) on delete cascade,
  contact_name text,
  phone text not null,
  store_name text,
  language text default 'english',
  message_body text not null,
  status text default 'pending',
  twilio_sid text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  replied_at timestamptz,
  reply_text text,
  created_at timestamptz default now()
);

alter table public.message_send_queue enable row level security;
alter table public.message_send_queue_items enable row level security;

create policy "Authenticated users can manage send queue"
  on public.message_send_queue for all to authenticated using (true) with check (true);

create policy "Authenticated users can manage send queue items"
  on public.message_send_queue_items for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.message_send_queue;
alter publication supabase_realtime add table public.message_send_queue_items;
