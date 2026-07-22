-- Eliminar cualquier restricción CHECK en la columna score de quiz_submissions
DO $$ 
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN (
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute attr ON attr.attnum = ANY(con.conkey)
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    WHERE ns.nspname = 'public' 
      AND cl.relname = 'quiz_submissions' 
      AND attr.attname = 'score'
      AND con.contype = 'c'
  )
  LOOP
    EXECUTE 'ALTER TABLE public.quiz_submissions DROP CONSTRAINT ' || quote_ident(constraint_name);
  END LOOP;
END $$;
