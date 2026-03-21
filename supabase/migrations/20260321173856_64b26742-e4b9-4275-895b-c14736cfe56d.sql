create table if not exists generated_assets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references store_master(id),
  lead_id uuid references outreach_leads(id),
  asset_type text not null,
  brand text,
  product_name text,
  canva_design_id text,
  canva_export_url text,
  canva_edit_url text,
  thumbnail_url text,
  status text default 'generating',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists canva_templates (
  id uuid primary key default gen_random_uuid(),
  template_name text not null,
  canva_template_id text not null,
  asset_type text not null,
  brand text,
  description text,
  placeholder_fields jsonb default '[]',
  is_active boolean default true,
  created_at timestamptz default now()
);

alter publication supabase_realtime add table generated_assets;

alter table generated_assets enable row level security;
alter table canva_templates enable row level security;

create policy "Authenticated users can read generated_assets"
  on generated_assets for select to authenticated using (true);

create policy "Authenticated users can insert generated_assets"
  on generated_assets for insert to authenticated with check (true);

create policy "Authenticated users can update generated_assets"
  on generated_assets for update to authenticated using (true);

create policy "Authenticated users can read canva_templates"
  on canva_templates for select to authenticated using (true);

create policy "Authenticated users can insert canva_templates"
  on canva_templates for insert to authenticated with check (true);

create policy "Authenticated users can update canva_templates"
  on canva_templates for update to authenticated using (true);