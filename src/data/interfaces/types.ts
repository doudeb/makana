import type { Subject, Question, Answer } from "./database";

export type SubjectWithQuestions = Subject & {
  questions: Question[];
};

export type AnswerFeedback = {
  question_id: string;
  score: number;
  feedback: string;
};

export type SubmissionResult = {
  submission_id: string;
  feedbacks: AnswerFeedback[];
};

export type AnswerWithFeedback = Answer & {
  question: Question;
};

export type SessionListItem = {
  id: string;
  student_name: string;
  submitted_at: string;
  subject: { id: string; code: string; question_count: number };
  answer_count: number;
  valid_count: number;
};

export type SessionStats = {
  total_sessions: number;
  unique_students: number;
  completion_rate: number;
  average_score: number;
  today_sessions: number;
};

export type SessionDetail = {
  id: string;
  student_name: string;
  submitted_at: string;
  subject: {
    id: string;
    code: string;
    reference_text: string;
    prompt_id: string | null;
    question_count: number;
  };
  prompt: {
    id: string;
    name: string;
    ai_prompt: string;
    ai_model: string;
    subject_count: number;
  } | null;
  answers: SessionAnswer[];
};

export type SessionAnswer = {
  id: string;
  question: {
    id: string;
    question_text: string;
    display_order: number;
    expected_answer_guidelines: string;
  };
  student_answer: string;
  ai_feedback: string | null;
  score: number | null;
  is_valid: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ReevalResult = {
  answer_id: string;
  question_text: string;
  ai_feedback: string;
  is_valid: boolean;
  score: number;
};
