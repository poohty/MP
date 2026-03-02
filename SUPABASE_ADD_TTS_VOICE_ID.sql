-- Add tts_voice_id column to user_profiles for per-user ElevenLabs voice selection
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tts_voice_id text;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
