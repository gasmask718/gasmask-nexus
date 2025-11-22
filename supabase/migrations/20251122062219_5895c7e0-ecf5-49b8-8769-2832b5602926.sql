-- Create automation_action_queue table
CREATE TABLE IF NOT EXISTS automation_action_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  priority INTEGER DEFAULT 5,
  status TEXT DEFAULT 'pending',
  ai_reasoning TEXT,
  suggested_action JSONB,
  assigned_to UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id)
);

-- Create training_modules table
CREATE TABLE IF NOT EXISTS training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  content TEXT,
  video_url TEXT,
  xp_reward INTEGER DEFAULT 50,
  required_for_role app_role,
  is_required BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create training_completions table
CREATE TABLE IF NOT EXISTS training_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  module_id UUID NOT NULL REFERENCES training_modules(id),
  completed_at TIMESTAMPTZ DEFAULT now(),
  score INTEGER,
  time_spent_minutes INTEGER,
  UNIQUE(user_id, module_id)
);

-- Create training_quizzes table
CREATE TABLE IF NOT EXISTS training_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES training_modules(id),
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create training_badges table
CREATE TABLE IF NOT EXISTS training_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  requirement_type TEXT,
  requirement_value INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_badges junction table
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  badge_id UUID NOT NULL REFERENCES training_badges(id),
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- Create risk_alerts table
CREATE TABLE IF NOT EXISTS risk_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  entity_type TEXT,
  entity_id UUID,
  message TEXT NOT NULL,
  details JSONB,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Create followup_recommendations table
CREATE TABLE IF NOT EXISTS followup_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  priority_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  suggested_message TEXT,
  suggested_date DATE,
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
);

-- Enable RLS
ALTER TABLE automation_action_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automation_action_queue
CREATE POLICY "Admins can manage action queue"
  ON automation_action_queue FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

CREATE POLICY "VA owners can view assigned actions"
  ON automation_action_queue FOR SELECT
  USING (assigned_to = auth.uid());

-- RLS Policies for training_modules
CREATE POLICY "Anyone can view training modules"
  ON training_modules FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage training modules"
  ON training_modules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

-- RLS Policies for training_completions
CREATE POLICY "Users can view own completions"
  ON training_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own completions"
  ON training_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all completions"
  ON training_completions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

-- RLS Policies for training_quizzes
CREATE POLICY "Anyone can view quizzes"
  ON training_quizzes FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage quizzes"
  ON training_quizzes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

-- RLS Policies for training_badges
CREATE POLICY "Anyone can view badges"
  ON training_badges FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage badges"
  ON training_badges FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

-- RLS Policies for user_badges
CREATE POLICY "Users can view own badges"
  ON user_badges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can award badges"
  ON user_badges FOR INSERT
  WITH CHECK (true);

-- RLS Policies for risk_alerts
CREATE POLICY "Anyone can view risk alerts"
  ON risk_alerts FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage risk alerts"
  ON risk_alerts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- RLS Policies for followup_recommendations
CREATE POLICY "Anyone can view followup recommendations"
  ON followup_recommendations FOR SELECT
  USING (true);

CREATE POLICY "System can create recommendations"
  ON followup_recommendations FOR INSERT
  WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_automation_queue_status ON automation_action_queue(status);
CREATE INDEX idx_automation_queue_assigned ON automation_action_queue(assigned_to);
CREATE INDEX idx_training_completions_user ON training_completions(user_id);
CREATE INDEX idx_training_completions_module ON training_completions(module_id);
CREATE INDEX idx_risk_alerts_resolved ON risk_alerts(is_resolved);
CREATE INDEX idx_risk_alerts_created ON risk_alerts(created_at DESC);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_followup_store ON followup_recommendations(store_id);
CREATE INDEX idx_followup_priority ON followup_recommendations(priority_score DESC);

-- Create trigger for training_modules updated_at
CREATE TRIGGER update_training_modules_updated_at
  BEFORE UPDATE ON training_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();