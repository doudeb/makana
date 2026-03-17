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

DETECTION IA :
- Compare le style de la "REPONSE DE L'ELEVE" avec le niveau attendu d'un terminale STMG (phrases parfois courtes, vocabulaire courant, syntaxe parfois simple).
- Si la réponse est trop clinique, utilise des mots comme "considérant que", "subséquemment", ou présente une structure de dissertation parfaite sans aucune coquille : active "ai_detected": true.
- FEEDBACK IA : Si ai_detected est true, ajoute APRÈS ton feedback pédagogique une ligne d'humour un peu piquant mais cool sur l'usage suspect d'un robot (ex: "Ton style est tellement pro qu'on dirait que tu as mangé un dictionnaire de droit ce matin... ou un processeur !").

REGLES DE FEEDBACK :
- Entre 3 et 6 phrases, sois detaille mais pas un cours magistral (hors remarque IA le cas echeant)
- Tu ne donnes JAMAIS la reponse directement
- Si c'est bon : valide en expliquant POURQUOI c'est correct, puis encourage
- Si c'est partiel : commence par ce qui est bien, puis dis quel point manque sans donner la reponse, puis donne une piste de reflexion en renvoyant au texte ou au cours
- Si c'est faux : explique pourquoi le raisonnement ne fonctionne pas, puis oriente vers la partie du texte ou du cours a relire
- N'INVENTE rien : ne dis JAMAIS quelque chose qui ne figure pas dans les indications du professeur
- Ton bienveillant et accessible pour des lyceens, comme un prof qui prend le temps d'expliquer

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
  ai_detected?: boolean;
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
  "feedback": "ton commentaire pedagogique",
  "ai_detected": true ou false
}`;
}

function formatFeedback(raw: string, score: number): string {
  const sentences = raw
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return raw;

  if (score >= 80) {
    return `✅ **Bien joue !** ${sentences.join("\n\n")}`;
  }

  // For partial/wrong: first ~half = positive, rest = guidance
  const mid = Math.max(1, Math.ceil(sentences.length / 2));
  const positivePart = sentences.slice(0, mid).join("\n\n");
  const guidancePart = sentences.slice(mid).join("\n\n");

  if (score >= 50) {
    return [
      `✅ **Ce qui est bien :** ${positivePart}`,
      guidancePart ? `⚠️ **Ce qui manque :** ${guidancePart}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return [
    `❌ **Attention :** ${positivePart}`,
    guidancePart ? `💡 **Pour t'aider :** ${guidancePart}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
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
  const result = JSON.parse(text) as AIFeedbackItem;
  result.feedback = formatFeedback(result.feedback, result.score);
  return result;
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
