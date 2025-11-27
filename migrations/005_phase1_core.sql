-- Phase 1: Core Enhancement + Stories
-- NOTE: recipients.id is TEXT type (not UUID)

-- Enhance recipients table
ALTER TABLE recipients 
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_recipients_name_search ON recipients(name);
CREATE INDEX IF NOT EXISTS idx_recipients_tags ON recipients USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_recipients_last_interaction ON recipients(last_interaction_at DESC NULLS LAST);

-- Messages table (recipient_id is TEXT to match recipients.id)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id TEXT NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  message_text TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  timestamp_label TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_search ON messages USING GIN(to_tsvector('english', message_text));

-- Status history
CREATE TABLE IF NOT EXISTS status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id TEXT NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  status_type TEXT,
  time_ago TEXT,
  streak_count INTEGER,
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_recipient ON status_history(recipient_id);
CREATE INDEX IF NOT EXISTS idx_status_history_captured ON status_history(captured_at DESC);

-- Story Posts (My Story & Spotlight/Public)
CREATE TABLE IF NOT EXISTS story_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_type TEXT NOT NULL CHECK (story_type IN ('my_story', 'spotlight', 'public')),
  media_path TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  duration_seconds INTEGER,
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB, -- Extra data like hashtags, location, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_posts_type ON story_posts(story_type);
CREATE INDEX IF NOT EXISTS idx_story_posts_posted_at ON story_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_posts_active ON story_posts(is_active) WHERE is_active = TRUE;

-- Story Analytics (aggregated stats per post)
CREATE TABLE IF NOT EXISTS story_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_post_id UUID NOT NULL UNIQUE REFERENCES story_posts(id) ON DELETE CASCADE,
  total_views INTEGER DEFAULT 0,
  total_screenshots INTEGER DEFAULT 0,
  total_shares INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_comments INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0, -- Unique viewers
  completion_rate DECIMAL(5,2), -- % who watched full video
  avg_watch_time_seconds INTEGER,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_analytics_post ON story_analytics(story_post_id);
CREATE INDEX IF NOT EXISTS idx_story_analytics_views ON story_analytics(total_views DESC);

-- Story Viewers (detailed viewer data)
CREATE TABLE IF NOT EXISTS story_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_post_id UUID NOT NULL REFERENCES story_posts(id) ON DELETE CASCADE,
  viewer_name TEXT NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  watch_duration_seconds INTEGER,
  took_screenshot BOOLEAN DEFAULT FALSE,
  shared BOOLEAN DEFAULT FALSE,
  UNIQUE(story_post_id, viewer_name)
);

CREATE INDEX IF NOT EXISTS idx_story_viewers_post ON story_viewers(story_post_id);
CREATE INDEX IF NOT EXISTS idx_story_viewers_viewed_at ON story_viewers(viewed_at DESC);

-- Story Engagement Snapshots (historical tracking)
CREATE TABLE IF NOT EXISTS story_engagement_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_post_id UUID NOT NULL REFERENCES story_posts(id) ON DELETE CASCADE,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_post ON story_engagement_snapshots(story_post_id);
CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_time ON story_engagement_snapshots(snapshot_at DESC);
