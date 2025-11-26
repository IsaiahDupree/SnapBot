-- Structured logs table
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
