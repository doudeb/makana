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
