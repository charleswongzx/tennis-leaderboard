-- Blitz Leaderboard 95 — D1 schema (idempotent)

CREATE TABLE IF NOT EXISTS players (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '🎾',
  tagline     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id          INTEGER PRIMARY KEY,
  date        TEXT NOT NULL,
  title       TEXT,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games (
  id           INTEGER PRIMARY KEY,
  session_id   INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 0,
  a1           INTEGER NOT NULL REFERENCES players(id),
  a2           INTEGER REFERENCES players(id),
  b1           INTEGER NOT NULL REFERENCES players(id),
  b2           INTEGER REFERENCES players(id),
  winner       TEXT NOT NULL CHECK (winner IN ('A','B')),
  score_text   TEXT
);

CREATE TABLE IF NOT EXISTS session_points (
  session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id   INTEGER NOT NULL REFERENCES players(id),
  points      INTEGER NOT NULL,
  PRIMARY KEY (session_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_games_session  ON games(session_id, position);
CREATE INDEX IF NOT EXISTS idx_points_player  ON session_points(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date  ON sessions(date DESC);
