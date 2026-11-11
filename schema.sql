-- Rolax Weembledon Championships '95 (powered by Blitz Academy) - D1 schema (idempotent)
--
-- One row per event. An event is either a quick scoreboard or a tournament.
-- The event's players, scores and matches live in the `data` JSON column; the
-- pages compute schedules and standings from it. `version` gives optimistic
-- concurrency: a write must quote the version it read, so two umpires editing
-- at once never silently overwrite each other.

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('scoreboard', 'tournament')),
  title       TEXT NOT NULL,
  date        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'finished')),
  winner      TEXT,
  data        TEXT NOT NULL DEFAULT '{}',
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(date DESC, id DESC);
