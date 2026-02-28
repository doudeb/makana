import { z } from "zod";

export const AVAILABLE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-flash-latest",
] as const;

export const promptFormSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(100),
  ai_prompt: z.string().min(1, "Le prompt est requis"),
  ai_model: z.enum(AVAILABLE_MODELS),
});

export type PromptFormData = z.infer<typeof promptFormSchema>;

export const promptTestSchema = z.object({
  ai_prompt: z.string().min(1),
  ai_model: z.enum(AVAILABLE_MODELS),
  reference_text: z.string().min(1, "Le texte de reference est requis"),
  question_text: z.string().min(1, "La question est requise"),
  expected_answer_guidelines: z.string().min(1, "Les indications sont requises"),
  student_answer: z.string().min(1, "La reponse eleve est requise"),
});

export type PromptTestData = z.infer<typeof promptTestSchema>;
