# 데이터베이스 설계 문서

## 개요

본 문서는 경량 LMS(Learning Management System) 웹 애플리케이션의 데이터베이스 설계를 정의한다. 사용자 플로우에 명시된 기능만을 포함하며, PostgreSQL을 기반으로 한다.

## 간략한 데이터플로우

### 1. 사용자 등록 및 인증
```
사용자 입력 → Supabase Auth → users 테이블 생성 → 역할 정보 저장 → 약관 동의 기록
```

### 2. 코스 관리
```
강사 코스 생성 → courses 테이블 저장 → 상태 관리 (draft → published → closed)
```

### 3. 수강신청 및 학습
```
학습자 코스 탐색 → 수강신청 → enrollments 테이블 기록 → 대시보드 반영
```

### 4. 과제 시스템
```
강사 과제 생성 → assignments 테이블 저장 → 학습자 과제 열람 → 제출 → submissions 테이블 기록 → 강사 채점 → 피드백 저장 → 재제출 요청 가능
```

### 5. 성적 관리
```
과제별 점수 입력 → course_grades 테이블 총점 계산 → 학습자 성적 확인
```

## 데이터베이스 스키마

### 1. users (사용자 테이블)

Supabase `auth.users` 테이블을 확장하여 역할 기반 사용자 정보를 저장한다.

```sql
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('learner', 'instructor')),
  name TEXT NOT NULL,
  phone_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**설계 의도:**
- `auth.users`와의 연동으로 인증 정보 활용
- 역할 기반 접근 제어 구현을 위한 `role` 필드
- 사용자 프로필 정보 저장

**인덱스:**
- `idx_users_email ON public.users(email)`
- `idx_users_role ON public.users(role)`

### 2. terms_agreements (약관 동의 이력 테이블)

사용자 온보딩 시 약관 동의 이력을 관리한다.

```sql
CREATE TABLE IF NOT EXISTS public.terms_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agreed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**설계 의도:**
- 법적 요구사항 준수를 위한 동의 이력 저장
- 사용자별 단일 기록 (최신 동의만 유지)

### 3. courses (코스 테이블)

강사가 개설한 코스 정보를 저장한다.

```sql
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
```

**설계 의도:**
- 코스 상태 관리 (초안 → 공개 → 마감)
- 강사별 코스 소유권 명시
- 카테고리 및 난이도 분류 지원

**인덱스:**
- `idx_courses_status ON public.courses(status)`
- `idx_courses_instructor_id ON public.courses(instructor_id)`

### 4. enrollments (수강신청 테이블)

학습자의 코스 등록 정보를 관리한다.

```sql
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);
```

**설계 의도:**
- 사용자별 코스별 단일 등록 보장
- 수강신청 시점 기록

**인덱스:**
- `idx_enrollments_user_id ON public.enrollments(user_id)`
- `idx_enrollments_course_id ON public.enrollments(course_id)`

### 5. assignments (과제 테이블)

강사가 생성한 과제 정보를 저장한다.

```sql
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
```

**설계 의도:**
- 코스별 과제 관리
- 마감일 및 정책 설정 (지각 허용, 재제출 허용)
- 상태 기반 공개 제어

**인덱스:**
- `idx_assignments_course_id ON public.assignments(course_id)`
- `idx_assignments_status ON public.assignments(status)`

### 6. submissions (제출물 테이블)

학습자의 과제 제출 정보를 관리한다.

```sql
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
```

**설계 의도:**
- 과제별 사용자별 단일 제출 보장
- 제출 시점 및 지각 여부 기록
- 채점 결과 및 피드백 저장

**인덱스:**
- `idx_submissions_assignment_id ON public.submissions(assignment_id)`
- `idx_submissions_user_id ON public.submissions(user_id)`
- `idx_submissions_status ON public.submissions(status)`

### 7. course_grades (코스 성적 테이블)

코스별 총점 정보를 저장한다.

```sql
CREATE TABLE IF NOT EXISTS public.course_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  total_score DECIMAL(5,2),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);
```

**설계 의도:**
- 사용자별 코스별 성적 관리
- 총점 계산 시점 기록

## 데이터 플로우 상세

### 사용자 등록 플로우
1. 사용자가 이메일/비밀번호로 회원가입
2. Supabase Auth가 `auth.users`에 사용자 생성
3. `users` 테이블에 역할 및 프로필 정보 저장
4. `terms_agreements`에 동의 이력 기록

### 코스 생성 플로우
1. 강사가 코스 정보 입력 (제목, 설명, 카테고리 등)
2. `courses` 테이블에 `draft` 상태로 저장
3. 강사가 공개 시 상태를 `published`로 변경

### 수강신청 플로우
1. 학습자가 공개된 코스 선택
2. `enrollments` 테이블에 관계 기록 생성
3. 중복 신청 방지를 위한 유니크 제약 조건 적용

### 과제 시스템 플로우
1. **과제 생성:** 강사가 `assignments`에 과제 정보 저장
2. **과제 공개:** 상태를 `published`로 변경
3. **과제 제출:** 학습자가 `submissions`에 제출물 저장
   - 마감일 검증으로 지각 여부 결정
4. **채점:** 강사가 점수와 피드백 입력, 상태 변경
5. **재제출:** 필요시 `resubmission_required` 상태로 변경

### 성적 계산 플로우
1. 모든 과제 채점 완료 시 트리거 작동
2. 가중치 반영하여 총점 계산
3. `course_grades` 테이블 업데이트

## 구현 가이드라인

### 제약조건 및 데이터 무결성
- 모든 테이블에 적절한 외래키 제약조건 적용
- 유니크 제약조건으로 중복 데이터 방지
- 체크 제약조건으로 데이터 유효성 보장

### 인덱싱 전략
- 조회 성능을 위한 적절한 인덱스 생성
- 복합 인덱스 활용으로 쿼리 최적화

### 트리거 및 자동화
- `updated_at` 자동 업데이트 트리거
- 성적 자동 계산 트리거 (구현 시 고려)

### 보안 고려사항
- RLS는 비활성화 (가이드라인 준수)
- 민감한 정보는 별도 암호화 고려
- 입력값 검증 및 sanitization 필수

이 스키마는 사용자 플로우의 모든 기능을 지원하면서도 최소한의 테이블 구조를 유지한다.
