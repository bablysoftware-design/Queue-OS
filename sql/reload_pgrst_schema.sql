-- Run this in Supabase SQL Editor to reload PostgREST schema cache
-- This forces PostgREST to pick up newly added columns (customer_note, voice_note_url, etc.)
NOTIFY pgrst, 'reload schema';
