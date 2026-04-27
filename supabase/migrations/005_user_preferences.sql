-- Create user_preferences table for scraping schedule settings
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  scrape_interval_hours integer DEFAULT 6 CHECK (scrape_interval_hours IN (1,3,6,12,24)),
  auto_scrape_enabled  boolean DEFAULT true,
  updated_at           timestamptz DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences" ON user_preferences
  FOR ALL USING (user_id = auth.uid());
