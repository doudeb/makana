import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const DEFAULT_MODEL = "gemini-2.5-flash";

export const DEFAULT_PROMPT = `Tu es un professeur bienveillant en classe de Terminale STMG. Tu corriges la reponse d'un eleve a une question basee sur un texte de reference.

REGLES IMPORTANTES :
- Tu ne donnes JAMAIS la reponse directement
- Attribue un score de 0 a 100 selon la qualite de la reponse
- Si la reponse est bonne (score >= 70) : valide-la avec des encouragements et explique pourquoi c'est juste
- Si la reponse est partielle (score 30-69) : reconnais les elements justes et donne des pistes pour completer
- Si la reponse est insuffisante (score < 30) : donne des pistes de reflexion pour guider l'eleve vers la bonne reponse, en te basant sur le texte de reference
- Sois bienveillant, pedagogique et encourageant
- Utilise un langage clair et accessible pour des eleves de Terminale
- Fais reference aux elements precis du texte de reference quand c'est pertinent
- Base ta correction UNIQUEMENT sur les indications de reponse fournies par le professeur, sans ajouter de notions supplementaires
- Adapte ton vocabulaire et tes explications au niveau Terminale STMG : reste simple, concret et accessible

TEXTE DE REFERENCE :
{{referenceText}}

QUESTION :
{{questionText}}

INDICATIONS DE REPONSE ATTENDUE (reste dans le cadre des instructions pour ne pas extrapoller) :
{{expectedAnswerGuidelines}}

REPONSE DE L'ELEVE :
{{studentAnswer}}`;

interface PromptVars {
  referenceText: string;
  questionText: string;
  expectedAnswerGuidelines: string;
  studentAnswer: string;
}

interface QuestionForAI {
  question_id: string;
  question_text: string;
  expected_answer_guidelines: string;
  student_answer: string;
}

interface AIFeedbackItem {
  question_id: string;
  score: number;
  feedback: string;
}

export function buildPrompt(template: string, vars: PromptVars): string {
  return template
    .replace(/\{\{referenceText\}\}/g, vars.referenceText)
    .replace(/\{\{questionText\}\}/g, vars.questionText)
    .replace(/\{\{expectedAnswerGuidelines\}\}/g, vars.expectedAnswerGuidelines)
    .replace(/\{\{studentAnswer\}\}/g, vars.studentAnswer);
}

function jsonInstruction(questionId: string): string {
  return `\n\nReponds en JSON avec exactement ce format :
{
  "question_id": "${questionId}",
  "score": un nombre entre 0 et 100,
  "feedback": "ton commentaire pedagogique"
}`;
}

export async function getPromptForSubject(
  promptId?: string | null
): Promise<{ template: string; model: string }> {
  if (!promptId) {
    return { template: DEFAULT_PROMPT, model: DEFAULT_MODEL };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("prompts")
    .select("ai_prompt, ai_model")
    .eq("id", promptId)
    .single();

  if (!data) {
    return { template: DEFAULT_PROMPT, model: DEFAULT_MODEL };
  }

  return { template: data.ai_prompt, model: data.ai_model };
}

export async function analyzeAnswer(
  referenceText: string,
  question: QuestionForAI,
  promptId?: string | null
): Promise<AIFeedbackItem> {
  const { template, model } = await getPromptForSubject(promptId);

  const prompt =
    buildPrompt(template, {
      referenceText,
      questionText: question.question_text,
      expectedAnswerGuidelines: question.expected_answer_guidelines,
      studentAnswer: question.student_answer,
    }) + jsonInstruction(question.question_id);

  const response = await genai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text ?? "";
  return JSON.parse(text) as AIFeedbackItem;
}

export async function runTestEvaluation(testData: {
  ai_prompt: string;
  ai_model: string;
  reference_text: string;
  question_text: string;
  expected_answer_guidelines: string;
  student_answer: string;
}): Promise<AIFeedbackItem> {
  const prompt =
    buildPrompt(testData.ai_prompt, {
      referenceText: testData.reference_text,
      questionText: testData.question_text,
      expectedAnswerGuidelines: testData.expected_answer_guidelines,
      studentAnswer: testData.student_answer,
    }) + jsonInstruction("test");

  const response = await genai.models.generateContent({
    model: testData.ai_model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text ?? "";
  return JSON.parse(text) as AIFeedbackItem;
}
