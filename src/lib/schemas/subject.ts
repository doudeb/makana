import { z } from "zod";

const questionSchema = z.object({
  question_text: z.string().min(1, "La question est requise"),
  expected_answer_guidelines: z
    .string()
    .min(1, "Les indications de reponse sont requises"),
});

export const subjectFormSchema = z.object({
  reference_text: z.string().min(1, "Le texte de reference est requis"),
  questions: z
    .array(questionSchema)
    .length(4, "Il faut exactement 4 questions"),
});

export type SubjectFormData = z.infer<typeof subjectFormSchema>;
