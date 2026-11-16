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

CREATE TABLE IF NOT EXISTS story_chat_exchanges (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  player_text text NOT NULL,
  reply_text text NOT NULL,
  UNIQUE (story_id, request_id)
);

CREATE INDEX IF NOT EXISTS story_chat_exchanges_history
  ON story_chat_exchanges (story_id, id);

ALTER TABLE stories ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS workspace_library (
  id integer PRIMARY KEY CHECK (id = 1),
  entries jsonb NOT NULL CHECK (jsonb_typeof(entries) = 'array'),
  version integer NOT NULL
);

INSERT INTO workspace_library (id, entries, version)
VALUES (1, '[]', 1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE workspace_library ADD COLUMN IF NOT EXISTS categories jsonb NOT NULL
  DEFAULT '[{"id":"source","name":"原作資料"},{"id":"original","name":"原創資料"}]'::jsonb;
