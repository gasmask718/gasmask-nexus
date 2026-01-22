-- =============================================
-- PHASE 2D: COMMISSION OVERRIDES ENGINE
-- Team / Manager / Hierarchy Payouts
-- =============================================

-- 0) CREATE set_updated_at FUNCTION IF NOT EXISTS
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1) OVERRIDE PLANS TABLE
-- Defines who gets paid and how much
create table if not exists public.commission_override_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  role_type text not null check (
    role_type in ('team_lead', 'manager', 'regional_manager', 'recruiter', 'custom')
  ),
  override_type text not null check (
    override_type in ('percentage', 'flat')
  ),
  override_value numeric not null,
  applies_to_channel text, -- null = all, or 'store_order','wholesale','affiliate'
  priority int not null default 100, -- lower runs first
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) OVERRIDE ASSIGNMENTS TABLE
-- Defines who receives the override and whose activity it applies to
create table if not exists public.commission_override_assignments (
  id uuid primary key default gen_random_uuid(),
  override_plan_id uuid not null references public.commission_override_plans(id) on delete cascade,
  beneficiary_ambassador_id uuid not null references public.ambassadors(id) on delete cascade,
  source_ambassador_id uuid references public.ambassadors(id) on delete cascade,
  source_store_id uuid references public.store_master(id) on delete cascade,
  active boolean not null default true,
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) ADD LINKAGE TO COMMISSION LEDGER
-- Creates a commission tree for traceability
alter table public.commission_ledger
  add column if not exists parent_commission_id uuid references public.commission_ledger(id),
  add column if not exists override_plan_id uuid references public.commission_override_plans(id);

-- Create index for efficient tree queries
create index if not exists idx_commission_ledger_parent on public.commission_ledger(parent_commission_id);
create index if not exists idx_commission_ledger_override_plan on public.commission_ledger(override_plan_id);

-- 4) OVERRIDE CALCULATION FUNCTION (THE ENGINE)
create or replace function public.apply_commission_overrides(p_commission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base public.commission_ledger%rowtype;
  plan record;
  amount numeric;
begin
  select * into base
  from public.commission_ledger
  where id = p_commission_id;

  -- Only apply to pending base commissions
  if base.status <> 'pending' then
    return;
  end if;

  -- Skip if this is already an override
  if base.parent_commission_id is not null then
    return;
  end if;

  for plan in
    select
      op.*,
      oa.beneficiary_ambassador_id
    from public.commission_override_assignments oa
    join public.commission_override_plans op on op.id = oa.override_plan_id
    where oa.active = true
      and op.active = true
      and (oa.source_ambassador_id is null or oa.source_ambassador_id = base.ambassador_id)
      and (oa.source_store_id is null or oa.source_store_id = base.store_id)
      and (op.applies_to_channel is null or op.applies_to_channel = base.source_channel)
      and (oa.start_date <= base.earned_at::date)
      and (oa.end_date is null or oa.end_date >= base.earned_at::date)
      -- Don't create override for the same ambassador
      and oa.beneficiary_ambassador_id <> base.ambassador_id
    order by op.priority asc
  loop
    if plan.override_type = 'percentage' then
      amount := round(base.gross_amount * (plan.override_value / 100.0), 2);
    else
      amount := plan.override_value;
    end if;

    if amount <= 0 then
      continue;
    end if;

    insert into public.commission_ledger (
      ambassador_id,
      store_id,
      source_channel,
      source_id,
      source_name,
      gross_amount,
      commission_rate,
      commission_amount,
      status,
      earned_at,
      currency,
      parent_commission_id,
      override_plan_id
    ) values (
      plan.beneficiary_ambassador_id,
      base.store_id,
      'team_override',
      base.id::text,
      'Override: ' || plan.name,
      0,
      plan.override_value,
      amount,
      'pending',
      base.earned_at,
      base.currency,
      base.id,
      plan.id
    );
  end loop;
end;
$$;

-- 5) TRIGGER — AUTO APPLY OVERRIDES
-- Only triggers for base commissions (parent_commission_id is null)
create or replace function public.trg_apply_overrides()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only apply to base commissions, not overrides
  if new.parent_commission_id is null and new.source_channel <> 'team_override' then
    perform public.apply_commission_overrides(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_commission_apply_overrides on public.commission_ledger;
create trigger trg_commission_apply_overrides
after insert on public.commission_ledger
for each row
execute function public.trg_apply_overrides();

-- 6) RLS — ADMIN ONLY FOR OVERRIDE MANAGEMENT
alter table public.commission_override_plans enable row level security;
alter table public.commission_override_assignments enable row level security;

-- Admin-only policies for override plans
create policy "admin_select_override_plans"
on public.commission_override_plans for select
using (public.is_elevated_user());

create policy "admin_insert_override_plans"
on public.commission_override_plans for insert
with check (public.is_elevated_user());

create policy "admin_update_override_plans"
on public.commission_override_plans for update
using (public.is_elevated_user())
with check (public.is_elevated_user());

create policy "admin_delete_override_plans"
on public.commission_override_plans for delete
using (public.is_elevated_user());

-- Admin-only policies for override assignments
create policy "admin_select_override_assignments"
on public.commission_override_assignments for select
using (public.is_elevated_user());

create policy "admin_insert_override_assignments"
on public.commission_override_assignments for insert
with check (public.is_elevated_user());

create policy "admin_update_override_assignments"
on public.commission_override_assignments for update
using (public.is_elevated_user())
with check (public.is_elevated_user());

create policy "admin_delete_override_assignments"
on public.commission_override_assignments for delete
using (public.is_elevated_user());

-- 7) UPDATED_AT TRIGGERS
drop trigger if exists trg_override_plans_updated_at on public.commission_override_plans;
create trigger trg_override_plans_updated_at
before update on public.commission_override_plans
for each row execute function public.set_updated_at();

drop trigger if exists trg_override_assignments_updated_at on public.commission_override_assignments;
create trigger trg_override_assignments_updated_at
before update on public.commission_override_assignments
for each row execute function public.set_updated_at();

-- 8) VIEW: OVERRIDE SUMMARY FOR ADMIN
create or replace view public.admin_override_summary as
select
  op.id as plan_id,
  op.name as plan_name,
  op.role_type,
  op.override_type,
  op.override_value,
  op.applies_to_channel,
  op.active as plan_active,
  count(distinct oa.id) as assignment_count,
  count(distinct cl.id) as commissions_generated,
  coalesce(sum(cl.commission_amount), 0) as total_paid_out
from public.commission_override_plans op
left join public.commission_override_assignments oa on oa.override_plan_id = op.id
left join public.commission_ledger cl on cl.override_plan_id = op.id
group by op.id, op.name, op.role_type, op.override_type, op.override_value, op.applies_to_channel, op.active;

-- 9) VIEW: AMBASSADOR OVERRIDE EARNINGS
create or replace view public.ambassador_override_earnings as
select
  cl.ambassador_id,
  cl.override_plan_id,
  op.name as plan_name,
  op.role_type,
  count(*) as override_count,
  sum(cl.commission_amount) as total_override_earnings
from public.commission_ledger cl
join public.commission_override_plans op on op.id = cl.override_plan_id
where cl.parent_commission_id is not null
group by cl.ambassador_id, cl.override_plan_id, op.name, op.role_type;