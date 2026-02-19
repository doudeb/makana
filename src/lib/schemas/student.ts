import { z } from "zod";

export const studentAccessSchema = z.object({
  code: z.string().min(1, "Le code du sujet est requis"),
  student_name: z.string().min(1, "Le prenom est requis"),
});

export type StudentAccessData = z.infer<typeof studentAccessSchema>;

export const singleAnswerSchema = z.object({
  subject_id: z.string().uuid(),
  student_name: z.string().min(1),
  submission_id: z.string().uuid().optional(),
  question_id: z.string().uuid(),
  student_answer: z.string().min(1, "La reponse est requise"),
});

export type SingleAnswerData = z.infer<typeof singleAnswerSchema>;

export const aiFeedbackSchema = z.object({
  question_id: z.string(),
  is_valid: z.boolean(),
  feedback: z.string(),
});

export type AIFeedbackData = z.infer<typeof aiFeedbackSchema>;
