-- Makana initial schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Subjects table
create table subjects (
  id uuid primary key default uuid_generate_v4(),
  reference_text text not null,
  code varchar(50) unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Questions table (4 questions per subject)
create table questions (
  id uuid primary key default uuid_generate_v4(),
  subject_id uuid not null references subjects(id) on delete cascade,
  question_text text not null,
  display_order integer not null check (display_order between 1 and 4),
  expected_answer_guidelines text not null,
  unique (subject_id, display_order)
);

-- Submissions table
create table submissions (
  id uuid primary key default uuid_generate_v4(),
  subject_id uuid not null references subjects(id) on delete cascade,
  student_name varchar(100) not null,
  submitted_at timestamptz default now()
);

-- Answers table
create table answers (
  id uuid primary key default uuid_generate_v4(),
  submission_id uuid not null references submissions(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  student_answer text not null,
  ai_feedback text,
  is_valid boolean
);

-- Indexes
create index idx_questions_subject_id on questions(subject_id);
create index idx_subjects_code on subjects(code);
create index idx_submissions_subject_id on submissions(subject_id);
create index idx_answers_submission_id on answers(submission_id);

-- Trigger for updated_at on subjects
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_subjects_updated_at
  before update on subjects
  for each row
  execute function update_updated_at_column();

-- Row Level Security
alter table subjects enable row level security;
alter table questions enable row level security;
alter table submissions enable row level security;
alter table answers enable row level security;

-- Subjects: public read, admin write
create policy "Public read subjects" on subjects
  for select using (true);

create policy "Admin insert subjects" on subjects
  for insert with check (auth.role() = 'authenticated');

create policy "Admin update subjects" on subjects
  for update using (auth.role() = 'authenticated');

create policy "Admin delete subjects" on subjects
  for delete using (auth.role() = 'authenticated');

-- Questions: public read, admin write
create policy "Public read questions" on questions
  for select using (true);

create policy "Admin insert questions" on questions
  for insert with check (auth.role() = 'authenticated');

create policy "Admin update questions" on questions
  for update using (auth.role() = 'authenticated');

create policy "Admin delete questions" on questions
  for delete using (auth.role() = 'authenticated');

-- Submissions: public insert + read
create policy "Public insert submissions" on submissions
  for insert with check (true);

create policy "Public read submissions" on submissions
  for select using (true);

-- Answers: public insert + read
create policy "Public insert answers" on answers
  for insert with check (true);

create policy "Public read answers" on answers
  for select using (true);
