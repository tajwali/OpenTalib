-- Add language and agent_ids columns to classrooms table
-- These were hardcoded as fallbacks in the API but should be stored per-course

ALTER TABLE public.classrooms 
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS agent_ids text[] DEFAULT '{}';

COMMENT ON COLUMN public.classrooms.language IS 'Language code for the course e.g. en, zh, ur';
COMMENT ON COLUMN public.classrooms.agent_ids IS 'Array of agent profile IDs used in this course';
