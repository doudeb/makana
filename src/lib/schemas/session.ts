import { z } from "zod";
import { AVAILABLE_MODELS } from "./prompt";

export const reevalSchema = z.object({
  answer_id: z.string().uuid().nullable(),
  prompt_override: z.string().min(1).nullable(),
  model_override: z.enum(AVAILABLE_MODELS).nullable(),
});

export type ReevalData = z.infer<typeof reevalSchema>;

export const savePromptSchema = z.object({
  prompt_text: z.string().min(1, "Le prompt est requis"),
  model: z.enum(AVAILABLE_MODELS),
  test_results: z.array(
    z.object({
      answer_id: z.string().uuid(),
      ai_feedback: z.string(),
      score: z.number().int().min(0).max(100),
      is_valid: z.boolean(),
    })
  ),
});

export type SavePromptData = z.infer<typeof savePromptSchema>;
