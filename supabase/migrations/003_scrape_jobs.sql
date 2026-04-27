CREATE TABLE scrape_jobs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id     uuid REFERENCES items(id) ON DELETE CASCADE,
  status      text CHECK (status IN ('pending', 'running', 'done', 'failed')) DEFAULT 'pending',
  triggered_by text CHECK (triggered_by IN ('manual', 'cron')) DEFAULT 'cron',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- RLS: user hanya bisa lihat job miliknya
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own jobs" ON scrape_jobs
  FOR SELECT USING (
    item_id IN (SELECT id FROM items WHERE user_id = auth.uid())
  );
