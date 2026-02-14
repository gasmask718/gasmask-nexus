
-- Phase 8: Confidence Correction (Display-Only Translation Layer)
-- Create table for human-approved confidence correction profiles

create table if not exists public.ai_confidence_corrections (
  id uuid primary key default gen_random_uuid(),

  -- Scope determines when correction applies
  scope_type text not null check (scope_type in ('global','sla','risk','territory')),
  scope_value text null,

  -- Confidence range this correction applies to
  confidence_min int not null check (confidence_min >= 0 and confidence_min <= 100),
  confidence_max int not null check (confidence_max >= 0 and confidence_max <= 100),

  -- Display offset in percentage points (e.g., -12 → show 73% instead of 85%)
  display_offset int not null check (display_offset >= -100 and display_offset <= 100),

  -- Status & audit
  status text not null default 'draft' check (status in ('draft','approved','rejected','rolled_back')),
  notes text null,

  created_at timestamptz not null default now(),
  created_by uuid null,

  approved_at timestamptz null,
  approved_by uuid null,

  rejected_at timestamptz null,
  rejected_by uuid null,

  rolled_back_at timestamptz null,
  rolled_back_by uuid null
);

-- Indexes for efficient querying
create index if not exists idx_conf_corr_scope
  on public.ai_confidence_corrections (scope_type, scope_value, confidence_min, confidence_max);

create index if not exists idx_conf_corr_status
  on public.ai_confidence_corrections (status, created_at desc);

-- Enable RLS
alter table public.ai_confidence_corrections enable row level security;

-- RLS Policy: Approved rows readable by authenticated users (for display translation)
create policy "read_approved_corrections"
on public.ai_confidence_corrections
for select
to authenticated
using (status = 'approved');

-- RLS Policy: Full access for admin/owner roles only (using user_roles table)
create policy "admin_full_access"
on public.ai_confidence_corrections
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'owner')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'owner')
  )
);
