-- Blitz Leaderboard 95 — Local dev sample data

-- Players
INSERT OR IGNORE INTO players (id, name, emoji, tagline) VALUES
  (1, 'Serena''s Stunt Double', '🦁', 'Growling at my own shadows'),
  (2, 'The Racket Scientist', '🧬', 'DNA strain: 80% sweat'),
  (3, 'Net Prophet', '🔮', 'They said I''d never hit a backhand'),
  (4, 'Baseline Karen', '👑', 'Your court, my rules'),
  (5, 'Volley Llama', '🦙', 'I spit when I miss');

-- Sessions
INSERT OR IGNORE INTO sessions (id, date, title, notes) VALUES
  (1, '2026-06-27', 'Sunday Slamdown', 'Weather was perfect, arguments were not'),
  (2, '2026-07-05', 'Independence Day Doubles Chaos', NULL),
  (3, '2026-07-12', 'Midweek Madness', NULL);

-- Games for Session 1
INSERT OR IGNORE INTO games (id, session_id, position, a1, a2, b1, b2, winner, score_text) VALUES
  (1, 1, 1, 1, NULL, 2, NULL, 'A', '6-4'),
  (2, 1, 2, 3, 4, 2, 5, 'B', '7-5'),
  (3, 1, 3, 1, NULL, 3, NULL, 'B', '3-6'),
  (4, 1, 4, 4, 5, 1, 2, 'A', 'they gave up');

-- Games for Session 2
INSERT OR IGNORE INTO games (id, session_id, position, a1, a2, b1, b2, winner, score_text) VALUES
  (5, 2, 1, 1, 2, 3, 4, 'A', '6-4'),
  (6, 2, 2, 5, NULL, 1, NULL, 'B', '7-6'),
  (7, 2, 3, 3, 5, 2, 4, 'B', '6-3'),
  (8, 2, 4, 1, NULL, 4, NULL, 'A', '6-1'),
  (9, 2, 5, 2, 3, 4, 5, 'A', '7-5');

-- Games for Session 3
INSERT OR IGNORE INTO games (id, session_id, position, a1, a2, b1, b2, winner, score_text) VALUES
  (10, 3, 1, 1, NULL, 2, NULL, 'A', '6-0'),
  (11, 3, 2, 3, 4, 5, 1, 'B', '5-7'),
  (12, 3, 3, 2, NULL, 3, NULL, 'B', '4-6'),
  (13, 3, 4, 4, 5, 1, 2, 'A', '6-4'),
  (14, 3, 5, 1, 3, 4, 5, 'B', '3-6'),
  (15, 3, 6, 2, NULL, 4, NULL, 'A', '6-2');

-- Session points for Session 1
INSERT OR IGNORE INTO session_points (session_id, player_id, points) VALUES
  (1, 1, 8),
  (1, 2, 6),
  (1, 3, 5),
  (1, 4, 7),
  (1, 5, 4);

-- Session points for Session 2
INSERT OR IGNORE INTO session_points (session_id, player_id, points) VALUES
  (2, 1, 9),
  (2, 2, 5),
  (2, 3, 6),
  (2, 4, 3),
  (2, 5, 7);

-- Session points for Session 3
INSERT OR IGNORE INTO session_points (session_id, player_id, points) VALUES
  (3, 1, 10),
  (3, 2, 6),
  (3, 3, 5),
  (3, 4, 8),
  (3, 5, 4);
