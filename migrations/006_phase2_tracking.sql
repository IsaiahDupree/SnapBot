-- Phase 2: Media & Tracking

-- Media items (snaps/videos)
CREATE TABLE IF NOT EXISTS media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id TEXT REFERENCES recipients(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  media_type TEXT NOT NULL,
  file_path TEXT,
  caption TEXT,
  duration_ms INTEGER,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  screenshot_taken BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_recipient ON media_items(recipient_id);
CREATE INDEX IF NOT EXISTS idx_media_type ON media_items(media_type);
CREATE INDEX IF NOT EXISTS idx_media_sent_at ON media_items(sent_at DESC);

-- Streak tracking
CREATE TABLE IF NOT EXISTS streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id TEXT NOT NULL UNIQUE REFERENCES recipients(id) ON DELETE CASCADE,
  current_count INTEGER DEFAULT 0,
  max_count INTEGER DEFAULT 0,
  last_snap_sent_at TIMESTAMPTZ,
  last_snap_received_at TIMESTAMPTZ,
  next_deadline_at TIMESTAMPTZ,
  auto_maintain BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_streaks_deadline ON streaks(next_deadline_at);
CREATE INDEX IF NOT EXISTS idx_streaks_auto_maintain ON streaks(auto_maintain) WHERE auto_maintain = TRUE;

-- Analytics events
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  recipient_id TEXT REFERENCES recipients(id) ON DELETE SET NULL,
  metadata JSONB,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_recipient ON analytics_events(recipient_id);
CREATE INDEX IF NOT EXISTS idx_analytics_occurred ON analytics_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_metadata ON analytics_events USING GIN(metadata);
