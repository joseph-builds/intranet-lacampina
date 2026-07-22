-- Drop check constraint on assignment_submissions score to allow numeric scores (0-20)
ALTER TABLE public.assignment_submissions DROP CONSTRAINT IF EXISTS assignment_submissions_score_check;
