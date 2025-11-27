-- Phase 3: Automation

-- Scheduled tasks
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  recipient_id TEXT REFERENCES recipients(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  schedule_type TEXT NOT NULL,
  schedule_expression TEXT,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_next_run ON scheduled_tasks(next_run_at) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduled_recipient ON scheduled_tasks(recipient_id);

-- Conversation metadata
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id TEXT NOT NULL UNIQUE REFERENCES recipients(id) ON DELETE CASCADE,
  total_messages_sent INTEGER DEFAULT 0,
  total_messages_received INTEGER DEFAULT 0,
  total_snaps_sent INTEGER DEFAULT 0,
  total_snaps_received INTEGER DEFAULT 0,
  avg_response_time_minutes INTEGER,
  last_message_at TIMESTAMPTZ,
  muted BOOLEAN DEFAULT FALSE,
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

-- Analytics views
CREATE OR REPLACE VIEW recent_activity AS
SELECT 
  ae.occurred_at,
  ae.event_type,
  r.name as recipient_name,
  ae.metadata
FROM analytics_events ae
LEFT JOIN recipients r ON r.id = ae.recipient_id
ORDER BY ae.occurred_at DESC;

CREATE OR REPLACE VIEW streak_dashboard AS
SELECT 
  r.name,
  s.current_count,
  s.next_deadline_at,
  EXTRACT(EPOCH FROM (s.next_deadline_at - NOW()))/3600 as hours_until_break,
  s.auto_maintain
FROM streaks s
JOIN recipients r ON r.id = s.recipient_id
WHERE s.current_count > 0
ORDER BY s.next_deadline_at ASC;

CREATE OR REPLACE VIEW engagement_metrics AS
SELECT 
  r.name,
  c.total_messages_sent + c.total_messages_received as total_messages,
  c.total_snaps_sent + c.total_snaps_received as total_snaps,
  c.avg_response_time_minutes,
  r.last_interaction_at,
  s.current_count as streak
FROM recipients r
LEFT JOIN conversations c ON c.recipient_id = r.id
LEFT JOIN streaks s ON s.recipient_id = r.id
ORDER BY r.last_interaction_at DESC NULLS LAST;
