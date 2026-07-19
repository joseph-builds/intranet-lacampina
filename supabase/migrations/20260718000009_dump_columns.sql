-- PLEASE RUN THIS IN SUPABASE SQL EDITOR TO SHOW ALL COLUMNS
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('exams', 'quizzes', 'course_events')
ORDER BY table_name, ordinal_position;
