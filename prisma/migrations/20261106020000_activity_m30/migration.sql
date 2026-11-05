-- M30 (docs/admin/04): one row per signed-in user per local day, written on the last_seen tick (at most every 5 minutes).
CREATE TABLE IF NOT EXISTS user_activity_days (
  user_id text NOT NULL REFERENCES auth(id) ON DELETE CASCADE,
  day date NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  touches integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS user_activity_days_day ON user_activity_days (day);
