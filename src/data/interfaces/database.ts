export interface Subject {
  id: string;
  reference_text: string;
  code: string;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  subject_id: string;
  question_text: string;
  display_order: number;
  expected_answer_guidelines: string;
}

export interface Submission {
  id: string;
  subject_id: string;
  student_name: string;
  submitted_at: string;
}

export interface Answer {
  id: string;
  submission_id: string;
  question_id: string;
  student_answer: string;
  ai_feedback: string | null;
  is_valid: boolean | null;
}
