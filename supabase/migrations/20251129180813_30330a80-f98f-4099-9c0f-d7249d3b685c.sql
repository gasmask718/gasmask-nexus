-- AI Workers table - represents AI employees
CREATE TABLE public.ai_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name TEXT NOT NULL,
  worker_role TEXT NOT NULL,
  worker_department TEXT NOT NULL,
  description TEXT,
  kpi_metrics JSONB DEFAULT '{}',
  memory JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sleeping', 'busy', 'error')),
  experience_points INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  last_task_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Work Tasks table - task queue
CREATE TABLE public.ai_work_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_title TEXT NOT NULL,
  task_details TEXT,
  assigned_to_worker_id UUID REFERENCES public.ai_workers(id),
  auto_assigned BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'escalated')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  department TEXT,
  tags TEXT[] DEFAULT '{}',
  input_data JSONB DEFAULT '{}',
  output JSONB DEFAULT '{}',
  error_message TEXT,
  parent_task_id UUID REFERENCES public.ai_work_tasks(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.ai_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_work_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_workers
CREATE POLICY "Authenticated users can view workers" ON public.ai_workers
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage workers" ON public.ai_workers
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can update workers" ON public.ai_workers
  FOR UPDATE USING (true);

-- RLS Policies for ai_work_tasks
CREATE POLICY "Authenticated users can view tasks" ON public.ai_work_tasks
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create tasks" ON public.ai_work_tasks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update tasks" ON public.ai_work_tasks
  FOR UPDATE USING (true);

CREATE POLICY "Admins can delete tasks" ON public.ai_work_tasks
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_ai_workers_department ON public.ai_workers(worker_department);
CREATE INDEX idx_ai_workers_status ON public.ai_workers(status);
CREATE INDEX idx_ai_work_tasks_status ON public.ai_work_tasks(status);
CREATE INDEX idx_ai_work_tasks_worker ON public.ai_work_tasks(assigned_to_worker_id);
CREATE INDEX idx_ai_work_tasks_priority ON public.ai_work_tasks(priority);

-- Insert default AI workers
INSERT INTO public.ai_workers (worker_name, worker_role, worker_department, description, kpi_metrics) VALUES
-- Sales/CRM Department
('Atlas', 'AI CRM Agent', 'Sales/CRM', 'Manages customer relationships, tracks store interactions, and maintains CRM data integrity.', '{"target_contacts_per_day": 50, "response_time_hours": 2}'),
('Scout', 'AI Store Checker', 'Sales/CRM', 'Monitors store activity, identifies inactive accounts, and flags stores needing attention.', '{"stores_checked_per_day": 100, "accuracy_rate": 95}'),
('Echo', 'AI Follow-Up Agent', 'Sales/CRM', 'Handles automated follow-ups, reminders, and re-engagement campaigns.', '{"follow_ups_per_day": 30, "conversion_rate": 15}'),
('Closer', 'AI Deal Closer', 'Sales/CRM', 'Identifies hot leads and opportunities ready for closing, prepares deal summaries.', '{"deals_identified_per_week": 10, "close_rate": 25}'),

-- Operations Department
('Navigator', 'AI Route Assistant', 'Operations', 'Optimizes delivery routes, assigns drivers, and manages logistics efficiency.', '{"routes_optimized_per_day": 20, "efficiency_improvement": 15}'),
('Keeper', 'AI Inventory Controller', 'Operations', 'Monitors stock levels, predicts demand, and manages reorder points.', '{"accuracy_rate": 98, "stockout_prevention_rate": 95}'),
('Forge', 'AI Production Supervisor', 'Operations', 'Plans production schedules, monitors output, and ensures quality targets.', '{"production_plans_per_day": 5, "on_time_rate": 90}'),
('Dispatch', 'AI Delivery Supervisor', 'Operations', 'Oversees delivery operations, tracks shipments, and resolves delivery issues.', '{"deliveries_supervised_per_day": 100, "success_rate": 98}'),

-- Wholesale Department
('Titan', 'AI Wholesale Manager', 'Wholesale', 'Manages wholesale relationships, tracks orders, and identifies growth opportunities.', '{"partners_managed": 50, "growth_rate": 10}'),
('Hunter', 'AI Store Acquisition Agent', 'Wholesale', 'Identifies potential new stores, researches markets, and prepares acquisition plans.', '{"leads_generated_per_week": 20, "conversion_rate": 15}'),
('Bond', 'AI Partner Success Agent', 'Wholesale', 'Ensures partner satisfaction, handles concerns, and maximizes partner value.', '{"satisfaction_score": 90, "retention_rate": 95}'),

-- Finance Department
('Ledger', 'AI Accountant', 'Finance', 'Manages financial records, calculates profits, and prepares financial reports.', '{"reports_generated_per_day": 10, "accuracy_rate": 99}'),
('Paymaster', 'AI Payroll Manager', 'Finance', 'Processes payroll, tracks hours, and manages compensation calculations.', '{"payrolls_processed_per_week": 50, "error_rate": 0.1}'),
('Hawk', 'AI Expense Analyzer', 'Finance', 'Analyzes spending patterns, identifies savings opportunities, and tracks budgets.', '{"savings_identified_per_month": 5000, "analysis_accuracy": 95}'),

-- Intelligence Department
('Sentinel', 'AI Risk Officer', 'Intelligence', 'Monitors risks across all departments, issues alerts, and recommends mitigations.', '{"risks_identified_per_day": 15, "prevention_rate": 80}'),
('Oracle', 'AI Insights Analyst', 'Intelligence', 'Generates business insights, identifies trends, and provides strategic recommendations.', '{"insights_per_day": 10, "actionability_rate": 70}'),
('Prophet', 'AI Trend Forecaster', 'Intelligence', 'Predicts market trends, forecasts demand, and anticipates business changes.', '{"forecast_accuracy": 85, "predictions_per_week": 20}'),

-- Global OS Department
('Cortex', 'AI Executive Assistant', 'Global OS', 'Handles executive-level tasks, prepares briefings, and coordinates across departments.', '{"briefings_per_day": 5, "task_completion_rate": 95}'),
('Guardian', 'AI Dynasty Guardian', 'Global OS', 'Oversees entire AI workforce, monitors system health, and ensures operational continuity.', '{"uptime": 99.9, "issue_resolution_time_hours": 1}'),
('Strategist', 'AI COO Assistant', 'Global OS', 'Assists with strategic planning, operational improvements, and cross-department coordination.', '{"strategies_developed_per_week": 5, "implementation_rate": 80}');