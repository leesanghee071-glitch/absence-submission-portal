-- 유학생 공가 대체 과제 제출 사이트 — 전체 스키마
-- Supabase SQL editor에서 한 번 실행합니다. 모든 테이블은 서버(service role)에서만 접근하며
-- RLS를 켜 두고 정책을 만들지 않아 anon 키로는 아무것도 읽을 수 없습니다.

create extension if not exists pgcrypto;

-- ───────── 설정 (한 행만 사용) ─────────
create table if not exists app_settings (
  id int primary key default 1 check (id = 1),
  deadline timestamptz,                       -- 전 과목 공통 마감일
  staff_session_days int not null default 30, -- 교수·학과장 로그인 유지 기간(일)
  student_quota_mb int,                       -- 학생별 총량 한도(MB), null = 제한 없음
  updated_at timestamptz not null default now()
);
insert into app_settings (id) values (1) on conflict do nothing;

-- ───────── 교수·학과장 ─────────
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,                 -- 소문자로 저장
  role text not null default 'professor' check (role in ('professor', 'head')),
  status text not null default 'invited' check (status in ('invited', 'active', 'disabled')),
  password_hash text,                         -- 선택. 없으면 이메일 링크로만 로그인
  totp_secret_enc text,                       -- (사용 안 함) 예전 인증 앱 방식의 흔적
  totp_enabled boolean not null default false, -- (사용 안 함)
  invited_at timestamptz,
  last_login_at timestamptz,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

-- 초대·로그인·비밀번호 재설정 링크 (토큰은 해시만 저장)
create table if not exists staff_tokens (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  purpose text not null check (purpose in ('invite', 'login', 'reset')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ───────── 과목·분반 ─────────
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  code text not null,                         -- 분반 (예: "01")
  assignment_count int not null default 3 check (assignment_count between 1 and 3),
  assignment_titles text[] not null default '{}', -- 과제 1~3번 제목(선택)
  created_at timestamptz not null default now(),
  unique (course_id, code)
);

create table if not exists section_professors (
  section_id uuid not null references sections(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  primary key (section_id, staff_id)
);

-- ───────── 학생 명단 ─────────
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  student_no text not null unique,
  name text not null,
  department text,
  birth_hash text not null,                   -- 생년월일 해시 (HMAC-SHA256 + 서버 비밀값)
  last_login_at timestamptz,
  failed_attempts int not null default 0,     -- 생년월일 대입 공격 방지: 5회 실패 시 15분 잠금
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  section_id uuid not null references sections(id) on delete cascade,
  absence_weeks text,                         -- 공가 인정 주차 (예: "1~3주")
  deadline_override timestamptz,              -- 학과장이 허용한 개별 마감 연장
  final_confirmed_at timestamptz,             -- 학과장 최종 확인
  final_confirmed_by uuid references staff(id),
  created_at timestamptz not null default now(),
  unique (student_id, section_id)
);

-- ───────── 제출 ─────────
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  slot int not null check (slot between 1 and 3),
  storage_path text,                          -- 보관 기간 종료 후 원본 삭제 시 null
  file_name text not null,                    -- 학번_이름_과목_과제번호.확장자
  original_name text not null,
  size_bytes bigint not null,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  reject_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references staff(id),
  reviewed_at timestamptz,
  file_deleted_at timestamptz,
  unique (enrollment_id, slot)
);

-- 업로드 링크 발급 기록 (서버가 발급한 경로만 확정 처리)
create table if not exists upload_tickets (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  slot int not null,
  storage_path text not null unique,
  original_name text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ───────── 알림 (학생은 이메일이 없으므로 화면 알림) ─────────
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_type text not null check (recipient_type in ('student', 'staff')),
  recipient_id uuid not null,
  message text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on notifications (recipient_type, recipient_id, read_at);

-- ───────── 감사 로그 ─────────
create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  actor_type text not null,                   -- 'staff' | 'student' | 'system'
  actor_id uuid,
  actor_label text,
  action text not null,
  target text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on audit_logs (created_at desc);

-- ───────── RLS: 서버 전용 ─────────
alter table app_settings enable row level security;
alter table staff enable row level security;
alter table staff_tokens enable row level security;
alter table courses enable row level security;
alter table sections enable row level security;
alter table section_professors enable row level security;
alter table students enable row level security;
alter table enrollments enable row level security;
alter table submissions enable row level security;
alter table upload_tickets enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- ───────── 비공개 파일 버킷 ─────────
-- 파일당 10MB, PDF·한글·워드만 허용 (서버 검사와 별개로 스토리지에서도 막음)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assignments', 'assignments', false, 10485760,
  array[
    'application/pdf',
    'application/x-hwp', 'application/haansofthwp', 'application/vnd.hancom.hwp',
    'application/hwp+zip', 'application/vnd.hancom.hwpx', 'application/haansofthwpx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream'
  ]
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ───────── 권한: 서버(service_role)만 읽고 쓴다 ─────────
-- 최근 Supabase 프로젝트는 SQL editor로 만든 테이블에 service_role 읽기·쓰기 권한을 자동으로 주지 않으므로
-- 명시적으로 부여하고, 브라우저용 anon/authenticated 역할의 권한은 모두 회수한다.
grant usage on schema public to service_role;
grant select, insert, update, delete on table
  app_settings, staff, staff_tokens, courses, sections, section_professors, students,
  enrollments, submissions, upload_tickets, notifications, audit_logs
to service_role;
grant usage, select on all sequences in schema public to service_role;
revoke all on table
  app_settings, staff, staff_tokens, courses, sections, section_professors, students,
  enrollments, submissions, upload_tickets, notifications, audit_logs
from anon, authenticated;

-- ───────── v0.2: 학생별 공가 주차(=과제 수) + 공지 ─────────
-- 공가 인정 주차는 승인된 과제 수로 정해진다. 학생마다(수강별로) 필요한 과제 수 1~3.
alter table enrollments add column if not exists required_count int not null default 3;
do $$ begin
  alter table enrollments add constraint enrollments_required_count_check check (required_count between 1 and 3);
exception when duplicate_object then null; end $$;

-- 전체 공지(section_id 없음, 학과장) / 과목 공지(section_id, 담당교수·학과장)
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references sections(id) on delete cascade,
  title text not null,
  body text not null default '',
  author_id uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists announcements_section_idx on announcements (section_id, created_at desc);
alter table announcements enable row level security;
grant select, insert, update, delete on table announcements to service_role;
revoke all on table announcements from anon, authenticated;
