-- Fix: 42P17 infinite recursion in RLS policies
--
-- Root cause: policies on tables like course_enrollments and courses contain
-- subqueries that JOIN or SELECT from profiles. When profiles itself is being
-- evaluated for RLS (e.g., the outer query IS on profiles), PostgreSQL detects
-- profiles appearing twice in the RLS evaluation stack and throws 42P17.
--
-- The same cycle occurs with has_role() and get_current_user_role(): they query
-- profiles without SET row_security = off, so they re-enter profiles RLS.
--
-- Fix:
--   1. Add SET row_security = off to all SECURITY DEFINER helper functions.
--   2. Introduce get_auth_user_id() with the same flag.
--   3. Replace raw (SELECT id FROM profiles WHERE user_id = auth.uid()) subqueries
--      in every policy with public.get_auth_user_id().

-- ─── Step 1: Fix helper functions ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of_student(_student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_student_relationships psr
    JOIN public.profiles p ON p.id = psr.parent_id
    WHERE p.user_id = auth.uid() AND psr.student_id = _student_id
  );
$$;

-- New helper: returns the profiles.id of the current authenticated user
-- SET row_security = off prevents re-entering profiles RLS from within a policy
CREATE OR REPLACE FUNCTION public.get_auth_user_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ─── Step 2: Fix course_enrollments policies ──────────────────────────────────

DROP POLICY IF EXISTS "Students can view their enrollments" ON public.course_enrollments;
CREATE POLICY "Students can view their enrollments" ON public.course_enrollments
  FOR SELECT USING (student_id = public.get_auth_user_id());

-- ─── Step 3: Fix assignment_submissions policies ──────────────────────────────

DROP POLICY IF EXISTS "Students can view their own submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Students can create their own submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Students can update their own submissions" ON public.assignment_submissions;

CREATE POLICY "Students can view their own submissions" ON public.assignment_submissions
  FOR SELECT USING (student_id = public.get_auth_user_id());

CREATE POLICY "Students can create their own submissions" ON public.assignment_submissions
  FOR INSERT WITH CHECK (student_id = public.get_auth_user_id());

CREATE POLICY "Students can update their own submissions" ON public.assignment_submissions
  FOR UPDATE USING (student_id = public.get_auth_user_id());

-- ─── Step 4: Fix attendance policies ─────────────────────────────────────────

DROP POLICY IF EXISTS "Students can view their own attendance" ON public.attendance;
CREATE POLICY "Students can view their own attendance" ON public.attendance
  FOR SELECT USING (student_id = public.get_auth_user_id());

-- ─── Step 5: Fix parent_student_relationships policies ────────────────────────

DROP POLICY IF EXISTS "Parents can view their relationships" ON public.parent_student_relationships;
CREATE POLICY "Parents can view their relationships" ON public.parent_student_relationships
  FOR SELECT USING (parent_id = public.get_auth_user_id());

-- ─── Step 6: Fix chatbot_conversations policies ───────────────────────────────

DROP POLICY IF EXISTS "Users can view their own conversations" ON public.chatbot_conversations;
DROP POLICY IF EXISTS "Users can create their own conversations" ON public.chatbot_conversations;

CREATE POLICY "Users can view their own conversations" ON public.chatbot_conversations
  FOR SELECT USING (user_id = public.get_auth_user_id());

CREATE POLICY "Users can create their own conversations" ON public.chatbot_conversations
  FOR INSERT WITH CHECK (user_id = public.get_auth_user_id());

-- ─── Step 7: Fix support_tickets policies ────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can create their own tickets" ON public.support_tickets;

CREATE POLICY "Users can view their own tickets" ON public.support_tickets
  FOR SELECT USING (user_id = public.get_auth_user_id());

CREATE POLICY "Users can create their own tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (user_id = public.get_auth_user_id());

-- ─── Step 8: Fix survey_responses policies ───────────────────────────────────

DROP POLICY IF EXISTS "Users can view their own responses" ON public.survey_responses;
DROP POLICY IF EXISTS "Users can create their own responses" ON public.survey_responses;

CREATE POLICY "Users can view their own responses" ON public.survey_responses
  FOR SELECT USING (respondent_id = public.get_auth_user_id());

CREATE POLICY "Users can create their own responses" ON public.survey_responses
  FOR INSERT WITH CHECK (respondent_id = public.get_auth_user_id());

-- ─── Step 9: Fix game_sessions policies ──────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their own game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Users can create their own game sessions" ON public.game_sessions;

CREATE POLICY "Users can view their own game sessions" ON public.game_sessions
  FOR SELECT USING (player_id = public.get_auth_user_id());

CREATE POLICY "Users can create their own game sessions" ON public.game_sessions
  FOR INSERT WITH CHECK (player_id = public.get_auth_user_id());

-- ─── Step 10: Fix reservations policies ──────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can create their own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can update their own reservations" ON public.reservations;

CREATE POLICY "Users can view their own reservations" ON public.reservations
  FOR SELECT USING (user_id = public.get_auth_user_id());

CREATE POLICY "Users can create their own reservations" ON public.reservations
  FOR INSERT WITH CHECK (user_id = public.get_auth_user_id());

CREATE POLICY "Users can update their own reservations" ON public.reservations
  FOR UPDATE USING (user_id = public.get_auth_user_id());

-- ─── Step 11: Fix courses policies ───────────────────────────────────────────
-- "Students can view enrolled courses" joins profiles directly, causing recursion
-- when the outer query is on courses and profiles is hit again via course_enrollments.

DROP POLICY IF EXISTS "Students can view enrolled courses" ON public.courses;
CREATE POLICY "Students can view enrolled courses" ON public.courses
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.course_enrollments ce
      JOIN public.modulos m ON m.id = ce.modulo_id
      WHERE m.course_id = courses.id
        AND ce.student_id = public.get_auth_user_id()
    )
  );

-- Teachers policies already reference teacher_principal_id with get_auth_user_id pattern;
-- update them to use the helper function if they still use raw subqueries.
DROP POLICY IF EXISTS "Teachers can view their courses" ON public.courses;
DROP POLICY IF EXISTS "Teachers can manage their courses" ON public.courses;

CREATE POLICY "Teachers can view their courses" ON public.courses
  FOR SELECT USING (teacher_principal_id = public.get_auth_user_id());

CREATE POLICY "Teachers can manage their courses" ON public.courses
  FOR ALL USING (teacher_principal_id = public.get_auth_user_id());

-- ─── Step 12: Fix profiles policies that use raw subqueries ──────────────────
-- "Users can view their own profile" uses user_id = auth.uid() — no subquery, safe.
-- "Admins can view/update all profiles" call has_role() which now has row_security=off — safe.
-- No changes needed for profiles policies themselves.

-- ─── Verification query (run manually in SQL Editor to confirm) ───────────────
-- SELECT has_role('admin'::user_role);
-- SELECT get_auth_user_id();
-- SELECT * FROM profiles WHERE role = 'student' LIMIT 1;
