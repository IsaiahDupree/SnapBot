-- Webhook events queue for reliable callbacks with retries
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  payload JSONB NOT NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 7,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | delivered | failed
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reuse set_updated_at trigger function from 001_init.sql
DROP TRIGGER IF EXISTS webhook_events_set_updated_at ON webhook_events;
CREATE TRIGGER webhook_events_set_updated_at
BEFORE UPDATE ON webhook_events
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
