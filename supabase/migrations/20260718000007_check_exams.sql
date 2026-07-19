-- CHECK EXAMS TABLE COLUMNS
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'exams' AND table_schema = 'public';
