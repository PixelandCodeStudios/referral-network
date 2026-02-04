-- Cloudflare D1 Database Schema for Referral Network Analytics
-- This schema stores all analytics events and partner interactions

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  session_id TEXT NOT NULL,
  referrer_id TEXT,
  partner_id TEXT,
  timestamp TEXT NOT NULL,
  url TEXT NOT NULL,
  ip TEXT,
  country TEXT,
  user_agent TEXT,
  data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_partner_id ON analytics_events(partner_id);
CREATE INDEX IF NOT EXISTS idx_referrer_id ON analytics_events(referrer_id);
CREATE INDEX IF NOT EXISTS idx_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_session_id ON analytics_events(session_id);

-- Composite index for partner reports (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_partner_timestamp ON analytics_events(partner_id, timestamp);
