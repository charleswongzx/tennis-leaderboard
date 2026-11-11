-- Rolax Weembledon '95 - local dev sample data (one finished scoreboard for the Roll of Champions)
-- Run after the Worker has created the table (load any page once): npx wrangler d1 execute tennis-leaderboard --local --file=seed.sql
INSERT OR IGNORE INTO events (id, kind, title, date, status, winner, data) VALUES
  (1, 'scoreboard', 'Sunday Slamdown', '2026-11-01', 'finished', '🦖 Serena-ish',
   '{"players":[{"id":"pa","name":"Serena-ish","emoji":"🦖"},{"id":"pb","name":"Big Dave","emoji":"🐐"},{"id":"pc","name":"Lobzilla","emoji":"🔥"}],"scores":{"pa":12,"pb":9,"pc":7}}');
