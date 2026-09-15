CREATE TABLE IF NOT EXISTS continue_watching (
  id SERIAL PRIMARY KEY,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  tmdb_id INTEGER NOT NULL,
  imdb_id TEXT,
  title TEXT NOT NULL,
  poster_path TEXT,
  season INTEGER,
  episode INTEGER,
  progress DOUBLE PRECISION NOT NULL DEFAULT 0,
  duration DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (media_type, tmdb_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  tmdb_id INTEGER NOT NULL,
  imdb_id TEXT,
  title TEXT NOT NULL,
  poster_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (media_type, tmdb_id)
);
