import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const DEFAULT_MODEL = "gemini-2.5-flash";

export const DEFAULT_PROMPT = `Tu es un correcteur automatique pour des eleves de Terminale STMG. Tu evalues STRICTEMENT la reponse de l'eleve par rapport aux INDICATIONS DE REPONSE fournies par le professeur.

METHODE DE CORRECTION :
1. Lis les INDICATIONS DE REPONSE du professeur : c'est ta SEULE reference pour juger si la reponse est correcte
2. Compare la reponse de l'eleve avec ces indications, mot-cle par mot-cle
3. Si l'eleve exprime la meme idee que les indications (meme avec d'autres mots) : c'est correct
4. Si l'eleve ajoute des choses qui ne sont pas dans les indications : ignore-les, ne les penalise pas mais ne les valorise pas non plus
5. Si l'eleve dit quelque chose de CONTRAIRE aux indications : c'est faux

REGLES DE SCORING :
- Score base UNIQUEMENT sur la correspondance avec les indications du professeur
- L'eleve a repris les idees essentielles des indications → 85-100%
- L'eleve a repris une partie des idees → 50-84%
- L'eleve est hors sujet ou contredit les indications → 0-49%
- Sois genereux : si l'idee principale est la, donne un bon score meme si la formulation est maladroite

REGLES DE FEEDBACK :
- Maximum 2-3 phrases, sois CONCIS
- Tu ne donnes JAMAIS la reponse directement
- Si c'est bon : valide avec un encouragement bref
- Si c'est partiel : dis quel point manque sans donner la reponse
- Si c'est faux : donne une piste de reflexion en renvoyant au texte
- N'INVENTE rien : ne dis JAMAIS quelque chose qui ne figure pas dans les indications du professeur
- Ton bienveillant et accessible pour des lyceens

TEXTE DE REFERENCE :
{{referenceText}}

QUESTION :
{{questionText}}

INDICATIONS DE REPONSE DU PROFESSEUR (ta SEULE source de verite pour la correction) :
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
  promptId?: string | null,
  options?: { promptOverride?: string; modelOverride?: string }
): Promise<AIFeedbackItem> {
  let template: string;
  let model: string;

  if (options?.promptOverride) {
    template = options.promptOverride;
    model = options?.modelOverride ?? DEFAULT_MODEL;
  } else {
    const promptConfig = await getPromptForSubject(promptId);
    template = promptConfig.template;
    model = options?.modelOverride ?? promptConfig.model;
  }

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
      temperature: 0,
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
      temperature: 0,
    },
  });

  const text = response.text ?? "";
  return JSON.parse(text) as AIFeedbackItem;
}
