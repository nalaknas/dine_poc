-- Add photo_labels column to store photo-to-dish mappings
ALTER TABLE posts ADD COLUMN IF NOT EXISTS photo_labels jsonb DEFAULT '{}'::jsonb;
