-- Create table for global recipient filters (whitelist/blacklist)
CREATE TABLE IF NOT EXISTS recipient_filters (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('whitelist','blacklist')),
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipient_filters_mode_idx ON recipient_filters(mode);
CREATE UNIQUE INDEX IF NOT EXISTS recipient_filters_mode_value_uidx ON recipient_filters(mode, lower(value));
