INSERT INTO pitches (name, location, capacity, open_time, close_time)
VALUES (
  'Football Pitch',
  'Downtown Sports Complex',
  20,
  '08:00'::TIME,
  '22:00'::TIME
)
ON CONFLICT DO NOTHING;
