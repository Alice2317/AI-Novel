CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 60),
  genre text NOT NULL,
  status text NOT NULL,
  summary text NOT NULL,
  original_mode text NOT NULL CHECK (original_mode IN ('none', 'active', 'reference')),
  story_language text NOT NULL CHECK (story_language IN ('zh-TW', 'en')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
