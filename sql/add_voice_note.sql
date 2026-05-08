-- Safe: adds nullable columns only, no existing data affected
ALTER TABLE tokens
  ADD COLUMN IF NOT EXISTS voice_note_url      TEXT,
  ADD COLUMN IF NOT EXISTS voice_note_duration INTEGER; -- seconds

-- Supabase Storage bucket creation (run in Supabase Dashboard → Storage)
-- Bucket name: voice-notes
-- Public: false (private, access via signed URLs)
-- File size limit: 512KB (enough for 15s compressed WebM)
-- Allowed MIME types: audio/webm, audio/ogg, audio/mp4
