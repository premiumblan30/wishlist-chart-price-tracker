CREATE TABLE IF NOT EXISTS alert_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled boolean DEFAULT true,
  alert_on_drop boolean DEFAULT true,
  alert_on_target boolean DEFAULT true,
  drop_threshold integer DEFAULT 5 CHECK (drop_threshold BETWEEN 1 AND 100),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own alerts" ON alert_settings FOR ALL USING (user_id = auth.uid());
