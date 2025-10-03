-- Migration: Create tables for userflow implementation
-- Creates core tables for learning management system based on userflow.md requirements

-- Ensure pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('learner', 'instructor')),
  name TEXT NOT NULL,
  phone_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS '사용자 테이블 - 학습자와 강사 정보를 저장';

-- Terms agreements table (약관 동의 이력)
CREATE TABLE IF NOT EXISTS public.terms_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agreed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

COMMENT ON TABLE public.terms_agreements IS '약관 동의 이력 테이블';

-- Courses table (코스 테이블)
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  instructor_id UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.courses IS '코스 테이블 - 강의 과정 정보를 저장';

-- Enrollments table (수강신청 테이블)
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

COMMENT ON TABLE public.enrollments IS '수강신청 테이블 - 학습자의 코스 등록 정보를 저장';

-- Assignments table (과제 테이블)
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  points_weight DECIMAL(5,2) NOT NULL CHECK (points_weight > 0 AND points_weight <= 100),
  allow_late_submission BOOLEAN NOT NULL DEFAULT FALSE,
  allow_resubmission BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.assignments IS '과제 테이블 - 강의 내 과제 정보를 저장';

-- Submissions table (제출물 테이블)
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text_content TEXT,
  link_url TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'resubmission_required')),
  is_late BOOLEAN NOT NULL DEFAULT FALSE,
  score DECIMAL(5,2) CHECK (score >= 0 AND score <= 100),
  feedback TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  graded_at TIMESTAMPTZ,
  UNIQUE(assignment_id, user_id)
);

COMMENT ON TABLE public.submissions IS '제출물 테이블 - 학습자의 과제 제출 정보를 저장';

-- Course grades table (코스 성적 테이블)
CREATE TABLE IF NOT EXISTS public.course_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  total_score DECIMAL(5,2),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

COMMENT ON TABLE public.course_grades IS '코스 성적 테이블 - 학습자의 코스별 총점 정보를 저장';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON public.courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON public.assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON public.assignments(status);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON public.submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);

-- Create trigger function for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create function for automatic grade calculation
CREATE OR REPLACE FUNCTION calculate_course_grades()
RETURNS TRIGGER AS $$
DECLARE
  course_record RECORD;
  student_record RECORD;
  total_weight DECIMAL(5,2);
  weighted_score DECIMAL(5,2);
  final_score DECIMAL(5,2);
BEGIN
  -- Only proceed if submission is marked as graded
  IF NEW.status = 'graded' AND OLD.status != 'graded' THEN
    -- Check if this is the last assignment to be graded for this course
    SELECT c.* INTO course_record
    FROM public.courses c
    WHERE c.id = (SELECT course_id FROM public.assignments WHERE id = NEW.assignment_id);

    -- For each student enrolled in this course
    FOR student_record IN
      SELECT DISTINCT e.user_id
      FROM public.enrollments e
      WHERE e.course_id = course_record.id
    LOOP
      -- Calculate total weighted score for this student
      SELECT
        COALESCE(SUM(
          CASE
            WHEN s.score IS NOT NULL THEN
              s.score * (a.points_weight / 100.0)
            ELSE 0
          END
        ), 0) INTO weighted_score
      FROM public.submissions s
      JOIN public.assignments a ON s.assignment_id = a.id
      WHERE s.user_id = student_record.user_id
        AND a.course_id = course_record.id
        AND s.status = 'graded';

      -- Get total weight of all assignments in the course
      SELECT COALESCE(SUM(points_weight), 0) INTO total_weight
      FROM public.assignments
      WHERE course_id = course_record.id;

      -- Calculate final score (percentage)
      IF total_weight > 0 THEN
        final_score := (weighted_score / total_weight) * 100;
      ELSE
        final_score := 0;
      END IF;

      -- Update or insert course grade
      INSERT INTO public.course_grades (user_id, course_id, total_score, calculated_at)
      VALUES (student_record.user_id, course_record.id, final_score, NOW())
      ON CONFLICT (user_id, course_id)
      DO UPDATE SET
        total_score = final_score,
        calculated_at = NOW();
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_terms_agreements_updated_at BEFORE UPDATE ON public.terms_agreements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_course_grades_updated_at BEFORE UPDATE ON public.course_grades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for automatic grade calculation when submissions are graded
CREATE TRIGGER trigger_calculate_course_grades
  AFTER UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION calculate_course_grades();

-- Disable Row Level Security as per guidelines
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.terms_agreements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.course_grades DISABLE ROW LEVEL SECURITY;
